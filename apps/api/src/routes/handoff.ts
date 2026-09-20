import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { query } from '../db/pool';
import { firebaseAuth } from '../lib/firebase';
import { ApiError, asyncHandler } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('handoff');
export const handoffRouter: Router = Router();

/**
 * Carrying a sign-in from the account domain to a salon's own.
 *
 * "Continue with Google" can only run on a domain Firebase has been told
 * about, and that list takes no wildcards — so it runs on the single account
 * domain and nowhere else. But a Firebase session belongs to the origin that
 * created it: signing in at cuenta.example.com leaves her signed out at
 * bella.example.com, which is where her panel is.
 *
 * So: she signs in on the account domain, that page asks for a code, and she
 * is sent to her own domain carrying it. Her own domain trades the code for a
 * custom token and signs her in there.
 *
 * Nothing here lets anyone become someone they were not already. Minting
 * requires her own ID token, and the code it returns only ever names the uid
 * that asked for it. What this adds is the crossing, not the identity.
 *
 * Three properties do the work, and all three matter:
 *
 *   - The code is single use. Redeeming deletes the row in the same statement
 *     that reads it, so two requests racing cannot both win.
 *   - It lives sixty seconds. Long enough for a redirect, short enough that a
 *     copy left in history is worthless by the time anyone reads it.
 *   - Only its SHA-256 is stored. A glance at the table — a backup, a log, a
 *     support query — yields nothing that can be redeemed.
 *
 * The code travels in the URL *fragment*, which browsers never send to a
 * server: not in the request, not in the Referer, not into any access log.
 * That is the web app's side of the bargain; see app/entrar/page.tsx.
 */

const TTL_SECONDS = 60;

/** A budget for both ends. Minting needs a session; redeeming needs a code. */
const limit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera un momento.' },
});

function hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
}

// ── Minting, on the account domain ───────────────────────────────────────────

/**
 * The salons this signed-in user owns, each with a code to enter it.
 *
 * A code per salon rather than one and then a choice: most owners have exactly
 * one, so this is a single round trip for almost everyone, and the codes she
 * does not use expire in a minute regardless.
 *
 * Outside `resolveTenant` on purpose. It is called from the account domain,
 * which is not a salon and never will be — resolving a tenant from the Host
 * here would 404 every time.
 */
handoffRouter.post(
    '/handoff',
    limit,
    requireAuth,
    asyncHandler(async (req, res) => {
        const uid = req.user!.uid;

        const owned = await query<{ id: string; domain: string; name: string | null }>(
            'SELECT id, domain, name FROM tenants WHERE owner_id = $1 ORDER BY created_at ASC',
            [uid]
        );

        if (owned.rows.length === 0) {
            // She is signed in and owns nothing. That is not an error on her
            // part and saying "unauthorised" would be a lie; it usually means
            // she signed in with the wrong Google account.
            throw ApiError.notFound('Esta cuenta de Google no administra ningún salón');
        }

        // Expired rows are swept here rather than on a timer: this table is
        // only ever written by this endpoint, so this is the one place that
        // knows it has grown.
        await query('DELETE FROM auth_handoffs WHERE expires_at < NOW()');

        const salons = [];
        for (const tenant of owned.rows) {
            const code = randomBytes(32).toString('base64url');
            await query(
                `INSERT INTO auth_handoffs (code_hash, uid, tenant_id, expires_at)
                 VALUES ($1, $2, $3, NOW() + make_interval(secs => $4))`,
                [hash(code), uid, tenant.id, TTL_SECONDS]
            );
            salons.push({ domain: tenant.domain, name: tenant.name, code });
        }

        log.info('Handoff minted', { uid, salons: salons.length });
        res.json({ salons, expiresIn: TTL_SECONDS });
    })
);

// ── Redeeming, on the salon's own domain ─────────────────────────────────────

const redeemSchema = z.object({
    code: z.string().trim().min(16).max(128),
});

/**
 * Trades a code for a token that signs her in on this domain.
 *
 * Unauthenticated by necessity — she has no session here yet; that is the
 * whole point. The code is the credential, which is why it is single use and
 * why it expires in a minute.
 *
 * The delete is the read. `DELETE ... RETURNING` is atomic, so a code that
 * arrives twice — a double-click, a retried request, someone replaying it —
 * can only ever produce one token. Doing it as SELECT-then-DELETE would leave
 * a window where both attempts see a live row.
 */
handoffRouter.post(
    '/handoff/redeem',
    limit,
    asyncHandler(async (req, res) => {
        const parsed = redeemSchema.safeParse(req.body);
        if (!parsed.success) throw ApiError.badRequest('Falta el código');

        const auth = firebaseAuth();
        if (!auth) throw new ApiError(503, 'El acceso no está configurado en este servidor');

        const claimed = await query<{ uid: string; code_hash: string; domain: string }>(
            `DELETE FROM auth_handoffs h
              USING tenants t
              WHERE h.code_hash = $1
                AND h.expires_at > NOW()
                AND t.id = h.tenant_id
              RETURNING h.uid, h.code_hash, t.domain`,
            [hash(parsed.data.code)]
        );

        const row = claimed.rows[0];
        if (!row) {
            // Used, expired, or never existed — all the same answer. Telling
            // them apart tells someone holding a stale code which kind of
            // stale it is, and none of the three has a different remedy.
            throw ApiError.unauthorized('Ese enlace ya no sirve. Vuelve a entrar.');
        }

        /*
         * The lookup already matched on the hash, so this can only fail if
         * Postgres returned a row it was not asked for. Checked anyway, in
         * constant time: the comparison that authorises a sign-in should not
         * be one nobody ever wrote down.
         */
        const want = Buffer.from(hash(parsed.data.code));
        const got = Buffer.from(row.code_hash);
        if (want.length !== got.length || !timingSafeEqual(want, got)) {
            log.error('Handoff hash mismatch after lookup', { uid: row.uid });
            throw ApiError.unauthorized('Ese enlace ya no sirve. Vuelve a entrar.');
        }

        let token: string;
        try {
            token = await auth.createCustomToken(row.uid);
        } catch (error) {
            log.error('Could not mint a custom token', { uid: row.uid, ...errorContext(error) });
            throw new ApiError(502, 'No pudimos completar el acceso. Intenta de nuevo.');
        }

        log.info('Handoff redeemed', { uid: row.uid, domain: row.domain });
        res.json({ token });
    })
);
