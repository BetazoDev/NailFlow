import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requirePlatform } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { firebaseAuth } from '../lib/firebase';
import { newId } from '../services/bookings';
import { summaryFor } from '../services/payments/accounts';
import { forgetRecipients } from '../services/notifications';
import { markPaid } from '../services/subscription';
import {
    checkConnection,
    hostingEnabled,
    registerDomain,
    unregisterDomain,
} from '../services/hosting';
import { checkMail, mailEnabled, sendInvite, type MailOutcome } from '../services/mail';
import {
    SLUG_PATTERN,
    cdnSummary,
    clearCdnAccount,
    probeToken,
    saveCdnAccount,
} from '../services/cdn';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('platform');
export const platformRouter: Router = Router();

/**
 * Diabolical's own panel.
 *
 * Mounted outside `resolveTenant`: these routes act across every salon, so the
 * Host header says nothing about which one is meant. Authorisation comes from
 * `requirePlatform` alone.
 */

// ── Auditoría ────────────────────────────────────────────────────────────────

/**
 * Records a cross-tenant action.
 *
 * Never allowed to fail the request it describes: losing the audit line for a
 * salon that was successfully created is bad, but refusing to create the salon
 * because the log write failed is worse.
 */
async function audit(
    actorEmail: string,
    action: string,
    tenantId: string | null,
    detail: Record<string, unknown> = {}
): Promise<void> {
    try {
        await query(
            `INSERT INTO platform_audit (id, actor_email, action, tenant_id, detail)
             VALUES ($1, $2, $3, $4, $5)`,
            [newId(), actorEmail, action, tenantId, JSON.stringify(detail)]
        );
    } catch (error) {
        log.error('Could not write the audit entry', { action, ...errorContext(error) });
    }
}

// ── Listado ──────────────────────────────────────────────────────────────────

interface TenantRow {
    id: string;
    domain: string;
    name: string | null;
    owner_id: string | null;
    owner_name: string | null;
    owner_email: string | null;
    owner_phone: string | null;
    owner_whatsapp: string | null;
    notes: string | null;
    subscription: { status?: string; plan?: string };
    created_at: Date;
}

const TENANT_COLUMNS = `id, domain, name, owner_id, owner_name, owner_email,
                        owner_phone, owner_whatsapp, notes, subscription, created_at`;

/**
 * Every salon, with the two facts that decide whether it is actually working:
 * whether an owner can sign in, and whether it can take money.
 */
platformRouter.get(
    '/tenants',
    requirePlatform,
    asyncHandler(async (_req, res) => {
        const result = await query<TenantRow & { appointments: string }>(
            `SELECT ${TENANT_COLUMNS.split(',').map(c => `t.${c.trim()}`).join(', ')},
                    (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id = t.id) AS appointments
             FROM tenants t
             ORDER BY t.created_at DESC`
        );

        const salons = await Promise.all(
            result.rows.map(async row => ({
                ...row,
                created_at: row.created_at.toISOString(),
                appointments: Number(row.appointments),
                gateway: await summaryFor(row.id),
            }))
        );

        res.json(salons);
    })
);

platformRouter.get(
    '/tenants/:id',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const result = await query<TenantRow>(
            `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = $1`,
            [req.params.id]
        );

        const tenant = result.rows[0];
        if (!tenant) throw ApiError.notFound('Ese salón no existe');

        res.json({
            ...tenant,
            created_at: tenant.created_at.toISOString(),
            gateway: await summaryFor(tenant.id),
        });
    })
);

// ── Alta ─────────────────────────────────────────────────────────────────────

/**
 * Subdomains the platform itself needs, or might.
 *
 * A salon called just "API" slugs to `api`, and if salons hang directly off the
 * product's domain that is the same host the API answers on. The two would
 * fight over it, and the outage would take a while to explain. Two-word names
 * are already safe — "API Nails" becomes `api-nails` — so this only catches the
 * narrow case, which is exactly when it is impossible to see coming.
 *
 * Kept to names that are, or plausibly will be, infrastructure. An earlier
 * version also held `test`, `blog`, `ayuda` and `soporte`, which protect nothing
 * and simply refuse a salon her own name — the first person it turned away was
 * someone typing "test" into the form.
 */
const RESERVED_LABELS = new Set([
    'api', 'app', 'admin', 'cuenta', 'panel', 'platform',
    'www', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets',
    'demo', 'staging', 'dev',
]);

const createSalonSchema = z.object({
    /** The host the salon is reached on; multi-tenancy resolves from it. */
    domain: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(253)
        .regex(/^[a-z0-9.-]+$/, 'El dominio solo admite letras, números, puntos y guiones')
        .refine(
            value => !RESERVED_LABELS.has(value.split('.')[0] ?? ''),
            'Ese subdominio está reservado para la plataforma. Elige otro.'
        ),
    name: z.string().trim().min(1).max(120),
    owner_name: z.string().trim().max(120).optional(),
    owner_email: z.string().trim().toLowerCase().email(),
    owner_phone: z.string().trim().max(40).optional(),
    owner_whatsapp: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(2000).optional(),
});

/**
 * Creates the salon and gives its owner a way in.
 *
 * No password is ever chosen, transmitted or stored here. The Firebase account
 * is created without one and the owner receives a reset link she uses to set
 * her own — so nobody at Diabolical ever knows her password, and there is no
 * credential to leak in an email we sent.
 */
platformRouter.post(
    '/tenants',
    requirePlatform,
    validateBody(createSalonSchema),
    asyncHandler(async (req, res) => {
        const body = req.body as z.infer<typeof createSalonSchema>;
        const actor = req.user!.email!;

        const clash = await query('SELECT 1 FROM tenants WHERE domain = $1', [body.domain]);
        if (clash.rowCount) throw ApiError.conflict('Ya hay un salón en ese dominio');

        const auth = firebaseAuth();
        if (!auth) throw new ApiError(503, 'El acceso no está configurado en este servidor');

        // Reuse the account when she already has one — a salon owner opening a
        // second location should not be locked out of her own email address.
        let uid: string;
        try {
            const existing = await auth.getUserByEmail(body.owner_email);
            uid = existing.uid;
        } catch {
            const created = await auth.createUser({
                email: body.owner_email,
                displayName: body.owner_name,
                emailVerified: false,
            });
            uid = created.uid;
        }

        const tenantId = newId();

        await query(
            `INSERT INTO tenants
                (id, domain, name, owner_id, owner_name, owner_email, owner_phone,
                 owner_whatsapp, notes, branding, settings, subscription)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                     '{}'::jsonb, '{}'::jsonb, $10::jsonb)`,
            [
                tenantId,
                body.domain,
                body.name,
                uid,
                body.owner_name ?? null,
                body.owner_email,
                body.owner_phone ?? null,
                body.owner_whatsapp ?? null,
                body.notes ?? null,
                JSON.stringify({ status: 'trial', plan: 'standard' }),
            ]
        );

        // The owner is also the salon's first bookable staff member; without
        // this she opens the panel to a calendar nobody can be booked into.
        await query(
            `INSERT INTO staff (id, tenant_id, name, email, role, slug, active, color_identifier)
             VALUES ($1, $2, $3, $4, 'owner', 'direccion', TRUE, '#C97794')`,
            [newId(), tenantId, body.owner_name || body.name, body.owner_email]
        );

        const invite = await inviteLink(body.owner_email, body.domain);

        // Registering the subdomain is best effort on purpose. The salon and her
        // owner's account already exist; refusing the whole creation because the
        // hosting panel was slow would leave a half-made salon and an operator
        // with no idea which half. A failure here is reported, and the panel
        // then shows the manual step.
        const hosting = await registerDomain(body.domain);

        /*
         * The letter goes out only once her subdomain is actually routed.
         *
         * It tells her where her panel is and sends her to set a password; if
         * the subdomain is not up yet she opens a link that goes nowhere, and
         * the first thing she ever sees of the product is a page that does not
         * load. When registration failed, the panel shows the manual step and
         * the button that sends this afterwards.
         *
         * Best effort even then, like the registration: the salon and her
         * account already exist, and refusing the whole creation because a mail
         * server was slow would leave a half-made salon and nobody sure which
         * half.
         */
        const mail: MailOutcome = !invite
            ? {
                  ok: false,
                  reason: 'unconfigured',
                  detail: 'No pudimos generar el enlace, así que no se envió nada.',
              }
            : !hosting.ok
              ? {
                    ok: false,
                    reason: 'unconfigured',
                    detail: 'No se envió todavía: su subdominio aún no responde.',
                }
              : await sendInvite({
                    to: body.owner_email,
                    salonName: body.name,
                    domain: body.domain,
                    link: invite,
                });

        await audit(actor, 'tenant.created', tenantId, {
            domain: body.domain,
            owner_email: body.owner_email,
            subdomain_registered: hosting.ok,
            invite_emailed: mail.ok,
        });

        log.info('Salon created', { tenantId, domain: body.domain, hosting: hosting.ok });
        res.status(201).json({ id: tenantId, domain: body.domain, invite, hosting, mail });
    })
);

/**
 * A link the owner uses to set her own password.
 *
 * Returned to the panel rather than emailed from here: Diabolical hands it over
 * however it already talks to the salon — WhatsApp, usually — and there is no
 * mail configuration standing between creating a salon and the owner getting in.
 *
 * The return address is the one account domain, never the salon's own. Firebase
 * only accepts a return address whose domain it has been told about, and that
 * list takes no wildcards — pointing it at each salon would mean authorising a
 * domain by hand for every salon created, which is exactly what running them
 * all on one deployment is meant to avoid. The account domain then forwards her
 * to her own panel.
 */
async function inviteLink(email: string, domain: string): Promise<string | null> {
    const auth = firebaseAuth();
    if (!auth) return null;

    const landing = env.accountDomain
        ? `https://${env.accountDomain}/entrar?salon=${encodeURIComponent(domain)}`
        : `https://${domain}/login`;

    try {
        return await auth.generatePasswordResetLink(email, { url: landing });
    } catch (error) {
        log.error('Could not generate the invitation link', { email, ...errorContext(error) });
        return null;
    }
}

/** Re-issues the invitation, for an owner who lost or never received it. */
platformRouter.post(
    '/tenants/:id/invite',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const result = await query<{ domain: string; name: string | null; owner_email: string | null }>(
            'SELECT domain, name, owner_email FROM tenants WHERE id = $1',
            [req.params.id]
        );

        const tenant = result.rows[0];
        if (!tenant) throw ApiError.notFound('Ese salón no existe');
        if (!tenant.owner_email) throw new ApiError(400, 'Este salón no tiene correo de contacto');

        const invite = await inviteLink(tenant.owner_email, tenant.domain);
        if (!invite) throw new ApiError(503, 'No pudimos generar el enlace de acceso');

        const mail = await sendInvite({
            to: tenant.owner_email,
            salonName: tenant.name ?? tenant.domain,
            domain: tenant.domain,
            link: invite,
        });

        await audit(req.user!.email!, 'tenant.invited', req.params.id, {
            owner_email: tenant.owner_email,
            emailed: mail.ok,
        });

        res.json({ invite, mail });
    })
);

/**
 * Whether a salon's subdomain actually reaches this deployment yet.
 *
 * Creating a salon writes a row; it does not create DNS or tell the reverse
 * proxy about her. Those are two manual steps, and forgetting either means the
 * owner receives an invitation link that goes nowhere — with no hint of why.
 * This is the check that turns "it does not work" into a specific next step.
 *
 * The three failure modes look different on purpose:
 *   - DNS missing        → the request never connects
 *   - proxy not told     → it connects and answers 404
 *   - certificate missing → the TLS handshake fails
 */
type DomainVerdict = 'ok' | 'no-dns' | 'no-route' | 'no-certificate' | 'unknown';

async function probeDomain(domain: string): Promise<{ verdict: DomainVerdict; detail: string }> {
    try {
        const response = await fetch(`https://${domain}/login`, {
            method: 'GET',
            redirect: 'manual',
            signal: AbortSignal.timeout(6_000),
        });

        if (response.status === 404) {
            return {
                verdict: 'no-route',
                detail: 'El servidor responde pero no conoce este subdominio.',
            };
        }
        return { verdict: 'ok', detail: 'Responde correctamente.' };
    } catch (error) {
        const reason = error instanceof Error ? `${error.message} ${error.cause ?? ''}` : '';

        if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(reason)) {
            return { verdict: 'no-dns', detail: 'El subdominio no existe en el DNS todavía.' };
        }
        if (/certificate|ERR_TLS|SSL|altname/i.test(reason)) {
            return {
                verdict: 'no-certificate',
                detail: 'Llega al servidor pero aún no tiene certificado.',
            };
        }
        return { verdict: 'unknown', detail: 'No pudimos comprobarlo.' };
    }
}

platformRouter.get(
    '/tenants/:id/domain',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const result = await query<{ domain: string }>(
            'SELECT domain FROM tenants WHERE id = $1',
            [req.params.id]
        );

        const domain = result.rows[0]?.domain;
        if (!domain) throw ApiError.notFound('Ese salón no existe');

        res.json({ domain, ...(await probeDomain(domain)) });
    })
);

/** Registers the subdomain for a salon whose first attempt did not go through. */
platformRouter.post(
    '/tenants/:id/register-domain',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const result = await query<{ domain: string }>(
            'SELECT domain FROM tenants WHERE id = $1',
            [req.params.id]
        );

        const domain = result.rows[0]?.domain;
        if (!domain) throw ApiError.notFound('Ese salón no existe');

        const outcome = await registerDomain(domain);
        await audit(req.user!.email!, 'tenant.domain_registered', req.params.id, {
            domain,
            ok: outcome.ok,
        });

        res.json(outcome);
    })
);

/** Confirms the hosting token works before an actual salon depends on it. */
platformRouter.get(
    '/hosting',
    requirePlatform,
    asyncHandler(async (_req, res) => {
        res.json({ enabled: hostingEnabled(), ...(await checkConnection()) });
    })
);

/**
 * Whether the mailbox that sends access letters actually works.
 *
 * Asked when the panel opens rather than behind a button, for the same reason
 * as the hosting check: finding out the password is wrong while creating a
 * salon means finding out in front of a customer.
 */
platformRouter.get(
    '/mail',
    requirePlatform,
    asyncHandler(async (_req, res) => {
        res.json({ enabled: mailEnabled(), ...(await checkMail()) });
    })
);

// ── Edición ──────────────────────────────────────────────────────────────────

const updateSalonSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    owner_name: z.string().trim().max(120).nullable().optional(),
    owner_phone: z.string().trim().max(40).nullable().optional(),
    owner_whatsapp: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    subscription: z
        .object({
            status: z.enum(['active', 'trial', 'cancelled']),
            plan: z.string().trim().min(1).max(60),
        })
        .optional(),
});

platformRouter.patch(
    '/tenants/:id',
    requirePlatform,
    validateBody(updateSalonSchema),
    asyncHandler(async (req, res) => {
        const body = req.body as z.infer<typeof updateSalonSchema>;

        const result = await query<TenantRow>(
            `UPDATE tenants SET
                name           = COALESCE($2, name),
                owner_name     = COALESCE($3, owner_name),
                owner_phone    = COALESCE($4, owner_phone),
                owner_whatsapp = COALESCE($5, owner_whatsapp),
                notes          = COALESCE($6, notes),
                subscription   = COALESCE($7::jsonb, subscription)
             WHERE id = $1
             RETURNING ${TENANT_COLUMNS}`,
            [
                req.params.id,
                body.name ?? null,
                body.owner_name ?? null,
                body.owner_phone ?? null,
                body.owner_whatsapp ?? null,
                body.notes ?? null,
                body.subscription ? JSON.stringify(body.subscription) : null,
            ]
        );

        const tenant = result.rows[0];
        if (!tenant) throw ApiError.notFound('Ese salón no existe');

        forgetRecipients(req.params.id);

        await audit(req.user!.email!, 'tenant.updated', req.params.id, {
            fields: Object.keys(body),
        });

        res.json({ ...tenant, created_at: tenant.created_at.toISOString() });
    })
);

/**
 * Records a monthly payment, extending the salon's period.
 *
 * This is the seam the plan left open. Whether the fee is collected by a
 * billing provider, a transfer or an invoice, the product only depends on this
 * having been called — so a webhook can call it later without anything else
 * changing.
 */
platformRouter.post(
    '/tenants/:id/paid',
    requirePlatform,
    validateBody(z.object({ months: z.coerce.number().int().min(1).max(24).default(1) })),
    asyncHandler(async (req, res) => {
        const exists = await query('SELECT 1 FROM tenants WHERE id = $1', [req.params.id]);
        if (!exists.rowCount) throw ApiError.notFound('Ese salón no existe');

        const months = (req.body as { months: number }).months;
        const subscription = await markPaid(req.params.id, months);

        await audit(req.user!.email!, 'subscription.paid', req.params.id, { months });
        res.json(subscription);
    })
);

/**
 * Deletes a salon, for cleaning up after a trial run.
 *
 * Refuses once the salon has appointments. Deleting cascades to her clients,
 * services and payment account, so a slip here would destroy a real salon's
 * history with no undo — and the only salons that genuinely need deleting are
 * the ones nobody ever booked into. A salon that is closing gets her
 * subscription cancelled instead, which stops new bookings and keeps the record.
 *
 * The domain has to go with her: a subdomain left registered still answers, and
 * still counts against the certificate authority's weekly quota.
 */
platformRouter.delete(
    '/tenants/:id',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const found = await query<{ domain: string; name: string | null }>(
            'SELECT domain, name FROM tenants WHERE id = $1',
            [req.params.id]
        );

        const tenant = found.rows[0];
        if (!tenant) throw ApiError.notFound('Ese salón no existe');

        const booked = await query<{ count: string }>(
            'SELECT COUNT(*) AS count FROM appointments WHERE tenant_id = $1',
            [req.params.id]
        );

        const appointments = Number(booked.rows[0]?.count ?? 0);
        if (appointments > 0) {
            throw new ApiError(
                409,
                `Este salón tiene ${appointments} cita(s). Cancela su suscripción en vez de ` +
                    'borrarlo: borrar arrastraría sus clientas y su historial.'
            );
        }

        const hosting = await unregisterDomain(tenant.domain);

        // Everything that hangs off the salon, removed explicitly and in one
        // transaction.
        //
        // The schema declares ON DELETE CASCADE on all of these, but the live
        // database disagreed: `staff` was created before that clause existed and
        // `CREATE TABLE IF NOT EXISTS` never alters a table that is already
        // there, so the file had been describing a shape the database did not
        // have. Nothing surfaced it until the first attempt to delete a salon.
        //
        // Naming the tables is also the better shape for a destructive
        // operation: the code says exactly what it destroys instead of trusting
        // a constraint nobody can see from here.
        await transaction(async tx => {
            await tx.query(
                `DELETE FROM appointment_services
                 WHERE appointment_id IN (SELECT id FROM appointments WHERE tenant_id = $1)`,
                [req.params.id]
            );
            for (const table of [
                'appointments',
                'client_favorites',
                'slot_locks',
                'services',
                'staff',
                'push_devices',
                'payment_accounts',
                'cdn_accounts',
            ]) {
                await tx.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [req.params.id]);
            }
            await tx.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
        });

        await audit(req.user!.email!, 'tenant.deleted', null, {
            domain: tenant.domain,
            name: tenant.name,
            domain_unregistered: hosting.ok,
        });

        log.info('Salon deleted', { domain: tenant.domain });
        res.json({ deleted: true, hosting });
    })
);

// ── Administradores de la plataforma ─────────────────────────────────────────

platformRouter.get(
    '/admins',
    requirePlatform,
    asyncHandler(async (_req, res) => {
        const result = await query<{ email: string; name: string | null }>(
            'SELECT email, name FROM platform_admins ORDER BY email'
        );

        res.json({
            admins: result.rows,
            /** Bootstrapped from the environment; not removable from here. */
            bootstrap: env.platformAdminEmails,
        });
    })
);

platformRouter.post(
    '/admins',
    requirePlatform,
    validateBody(
        z.object({
            email: z.string().trim().toLowerCase().email(),
            name: z.string().trim().max(120).optional(),
        })
    ),
    asyncHandler(async (req, res) => {
        const { email, name } = req.body as { email: string; name?: string };

        await query(
            `INSERT INTO platform_admins (email, name) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, platform_admins.name)`,
            [email, name ?? null]
        );

        await audit(req.user!.email!, 'admin.added', null, { email });
        res.status(201).json({ email, name: name ?? null });
    })
);

platformRouter.delete(
    '/admins/:email',
    requirePlatform,
    asyncHandler(async (req, res) => {
        const email = req.params.email.toLowerCase();

        // Removing yourself from the panel that manages the panel is a mistake
        // with no undo from inside the product.
        if (email === req.user!.email!.toLowerCase()) {
            throw new ApiError(400, 'No puedes quitarte a ti misma');
        }

        await query('DELETE FROM platform_admins WHERE LOWER(email) = $1', [email]);
        await audit(req.user!.email!, 'admin.removed', null, { email });
        res.sendStatus(204);
    })
);

// ── Almacenamiento de imágenes ───────────────────────────────────────────────

/**
 * Each salon's own CDN project and keys.
 *
 * This lives in Diabolical's panel and not in the salon's: she does not have a
 * CDN account, and the keys are ours to issue and to rotate. It is also the
 * only place where handing the wrong key to the wrong salon would put her
 * clients' photos in someone else's folder, so it stays where one person is
 * doing it deliberately.
 *
 * The keys are never read back out. A salon's stored key is write-only from
 * here on: the panel is told whether one exists, never what it is.
 */

platformRouter.get(
    '/tenants/:id/cdn',
    requirePlatform,
    asyncHandler(async (req, res) => {
        res.json(await cdnSummary(req.params.id));
    })
);

const cdnSchema = z.object({
    slug: z
        .string()
        .trim()
        .regex(SLUG_PATTERN, 'La carpeta solo admite letras, números, guion y guion bajo'),
    // Absent means "leave the stored key alone". The panel never shows them
    // back, so submitting the form to fix a typo in the folder must not wipe
    // keys the operator no longer has a copy of.
    upload_token: z.string().trim().min(8).max(500).optional(),
    reference_token: z.string().trim().min(8).max(500).optional(),
});

platformRouter.put(
    '/tenants/:id/cdn',
    requirePlatform,
    validateBody(cdnSchema),
    asyncHandler(async (req, res) => {
        const body = req.body as z.infer<typeof cdnSchema>;

        const exists = await query('SELECT 1 FROM tenants WHERE id = $1', [req.params.id]);
        if (exists.rows.length === 0) throw ApiError.notFound('Ese salón no existe');

        // A folder already claimed by another salon is the one mistake this
        // whole feature exists to prevent, so it is caught by name rather than
        // surfacing as a unique-constraint error nobody can read.
        const taken = await query<{ tenant_id: string }>(
            'SELECT tenant_id FROM cdn_accounts WHERE slug = $1 AND tenant_id <> $2',
            [body.slug, req.params.id]
        );
        if (taken.rows.length > 0) {
            throw ApiError.badRequest('Esa carpeta ya es de otro salón. Cada una necesita la suya.');
        }

        try {
            await saveCdnAccount(req.params.id, {
                slug: body.slug,
                uploadToken: body.upload_token,
                referenceToken: body.reference_token,
            });
        } catch (error) {
            log.error('Could not store CDN keys', {
                tenantId: req.params.id,
                ...errorContext(error),
            });
            throw new ApiError(
                503,
                error instanceof Error ? error.message : 'No pudimos guardar las claves.'
            );
        }

        await audit(req.user!.email!, 'tenant.cdn.updated', req.params.id, {
            slug: body.slug,
            // Which keys were replaced, never the keys.
            replaced: [
                body.upload_token ? 'upload' : null,
                body.reference_token ? 'reference' : null,
            ].filter(Boolean),
        });

        res.json(await cdnSummary(req.params.id));
    })
);

platformRouter.delete(
    '/tenants/:id/cdn',
    requirePlatform,
    asyncHandler(async (req, res) => {
        await clearCdnAccount(req.params.id);
        await audit(req.user!.email!, 'tenant.cdn.cleared', req.params.id);
        res.json(await cdnSummary(req.params.id));
    })
);

/**
 * Checks a key before it is stored, and says which folder it writes into.
 *
 * The folder is the answer that matters. A key that authenticates but belongs
 * to a different project would file the salon's photos somewhere nothing looks
 * for them, and that failure is silent until she wonders where her pictures
 * went.
 */
platformRouter.post(
    '/cdn/probe',
    requirePlatform,
    validateBody(z.object({ token: z.string().trim().min(8).max(500) })),
    asyncHandler(async (req, res) => {
        res.json(await probeToken((req.body as { token: string }).token));
    })
);

// ── Registro ─────────────────────────────────────────────────────────────────

platformRouter.get(
    '/audit',
    requirePlatform,
    asyncHandler(async (_req, res) => {
        const result = await query(
            `SELECT id, actor_email, action, tenant_id, detail, created_at
             FROM platform_audit ORDER BY created_at DESC LIMIT 200`
        );
        res.json(result.rows);
    })
);

/** Whether the caller may open the panel at all — the web app asks before routing. */
platformRouter.get('/session', requirePlatform, (req: Request, res: Response) => {
    res.json({
        email: req.user!.email,
        platformAdmin: true,
        // Sent rather than built into the panel, so changing the root domain is
        // a variable on the server and not a rebuild of the web app.
        rootDomain: env.rootDomain ?? null,
    });
});
