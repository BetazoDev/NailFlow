import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requirePlatform } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { firebaseAuth } from '../lib/firebase';
import { newId } from '../services/bookings';
import { summaryFor } from '../services/payments/accounts';
import { forgetRecipients } from '../services/notifications';
import { markPaid } from '../services/subscription';
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

const createSalonSchema = z.object({
    /** The host the salon is reached on; multi-tenancy resolves from it. */
    domain: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(253)
        .regex(/^[a-z0-9.-]+$/, 'El dominio solo admite letras, números, puntos y guiones'),
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

        await audit(actor, 'tenant.created', tenantId, {
            domain: body.domain,
            owner_email: body.owner_email,
        });

        const invite = await inviteLink(body.owner_email, body.domain);

        log.info('Salon created', { tenantId, domain: body.domain });
        res.status(201).json({ id: tenantId, domain: body.domain, invite });
    })
);

/**
 * A link the owner uses to set her own password.
 *
 * Returned to the panel rather than emailed from here: Diabolical hands it over
 * however it already talks to the salon — WhatsApp, usually — and there is no
 * mail configuration standing between creating a salon and the owner getting in.
 */
async function inviteLink(email: string, domain: string): Promise<string | null> {
    const auth = firebaseAuth();
    if (!auth) return null;

    try {
        return await auth.generatePasswordResetLink(email, {
            url: `https://${domain}/login`,
        });
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
        const result = await query<{ domain: string; owner_email: string | null }>(
            'SELECT domain, owner_email FROM tenants WHERE id = $1',
            [req.params.id]
        );

        const tenant = result.rows[0];
        if (!tenant) throw ApiError.notFound('Ese salón no existe');
        if (!tenant.owner_email) throw new ApiError(400, 'Este salón no tiene correo de contacto');

        const invite = await inviteLink(tenant.owner_email, tenant.domain);
        if (!invite) throw new ApiError(503, 'No pudimos generar el enlace de acceso');

        await audit(req.user!.email!, 'tenant.invited', req.params.id, {
            owner_email: tenant.owner_email,
        });

        res.json({ invite });
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
    res.json({ email: req.user!.email, platformAdmin: true });
});
