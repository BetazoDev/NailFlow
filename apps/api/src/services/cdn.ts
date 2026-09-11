import { query } from '../db/pool';
import { env } from '../config/env';
import { open, seal, secretsEnabled } from '../lib/secretbox';
import { createLogger, errorContext } from '../lib/logger';

import { storedSpellings } from '../lib/image-paths';

export { resolveImagePath } from '../lib/image-paths';

const log = createLogger('cdn');

/**
 * Where a salon's images live, and the keys that write them.
 *
 * Every salon used to share one CDN project and one pair of keys. That had
 * three consequences, and only the last is obvious:
 *
 *   - Her clients' reference photos landed in the same folder as every other
 *     salon's, so there was no order by salon in the CDN at all.
 *   - The read proxy served any path it was handed, so one salon's page could
 *     serve another salon's photos to anyone who knew a filename.
 *   - A leaked key could only be rotated for every salon at once.
 *
 * The folder is not something the browser picks: the CDN derives it from the
 * key. So a key per salon is what actually separates them, and everything here
 * exists to hold those keys and to refuse to serve outside her own folder.
 */

/** Folders the salon herself manages. Everything else is a client photo. */
export const SYSTEM_FOLDERS = new Set(['services', 'team', 'staff', 'branding', 'profile']);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface CdnAccount {
    slug: string;
    uploadToken: string | null;
    referenceToken: string | null;
    /** False when this is the shared fallback rather than the salon's own. */
    own: boolean;
}

interface Row {
    slug: string;
    upload_token: string | null;
    reference_token: string | null;
    updated_at: Date;
}

/** The shared account: what a salon without her own keys still uses. */
function shared(): CdnAccount {
    return {
        slug: env.cdn.sharedSlug,
        uploadToken: env.cdn.systemToken ?? null,
        referenceToken: env.cdn.referenceToken ?? null,
        own: false,
    };
}

/**
 * The salon's own CDN account, or the shared one.
 *
 * A row that cannot be opened falls back to shared rather than throwing: it
 * means CREDENTIALS_KEY was rotated, and a salon whose photos stop loading is
 * a smaller failure than a salon whose page will not render at all.
 */
export async function cdnFor(tenantId: string): Promise<CdnAccount> {
    const result = await query<Row>(
        `SELECT slug, upload_token, reference_token, updated_at
           FROM cdn_accounts WHERE tenant_id = $1`,
        [tenantId]
    );

    const row = result.rows[0];
    if (!row) return shared();

    try {
        return {
            slug: row.slug,
            uploadToken: row.upload_token ? open(row.upload_token) : null,
            referenceToken: row.reference_token ? open(row.reference_token) : null,
            own: true,
        };
    } catch (error) {
        log.error('Could not open a salon CDN account; falling back to the shared one', {
            tenantId,
            ...errorContext(error),
        });
        return shared();
    }
}

// ── What the platform panel may see ──────────────────────────────────────────

export interface CdnSummary {
    configured: boolean;
    slug: string;
    /** Whether each key is present — never what it is. */
    hasUploadToken: boolean;
    hasReferenceToken: boolean;
    updatedAt: string | null;
    /** False when the API cannot seal, so nothing can be stored yet. */
    storable: boolean;
    /** The folder salons fall back to while they have no account of their own. */
    sharedSlug: string;
}

export async function cdnSummary(tenantId: string): Promise<CdnSummary> {
    const result = await query<Row>(
        `SELECT slug, upload_token, reference_token, updated_at
           FROM cdn_accounts WHERE tenant_id = $1`,
        [tenantId]
    );
    const row = result.rows[0];

    return {
        configured: Boolean(row),
        slug: row?.slug ?? env.cdn.sharedSlug,
        hasUploadToken: Boolean(row?.upload_token),
        hasReferenceToken: Boolean(row?.reference_token),
        updatedAt: row?.updated_at.toISOString() ?? null,
        storable: secretsEnabled(),
        sharedSlug: env.cdn.sharedSlug,
    };
}

export interface CdnInput {
    slug: string;
    /** Omitted means "leave the stored one alone"; a value replaces it. */
    uploadToken?: string;
    referenceToken?: string;
}

export async function saveCdnAccount(tenantId: string, input: CdnInput): Promise<void> {
    if (!secretsEnabled()) {
        throw new Error('CREDENTIALS_KEY no está configurada en la API; no se pueden guardar claves.');
    }

    // The keys are only overwritten when new ones were actually typed. The
    // panel never shows them back, so without this, correcting a typo in the
    // folder name would silently wipe both — and they are not recoverable.
    await query(
        `INSERT INTO cdn_accounts (tenant_id, slug, upload_token, reference_token, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
             slug            = EXCLUDED.slug,
             upload_token    = CASE WHEN $5 THEN EXCLUDED.upload_token
                                    ELSE cdn_accounts.upload_token END,
             reference_token = CASE WHEN $6 THEN EXCLUDED.reference_token
                                    ELSE cdn_accounts.reference_token END,
             updated_at      = NOW()`,
        [
            tenantId,
            input.slug,
            input.uploadToken ? seal(input.uploadToken) : null,
            input.referenceToken ? seal(input.referenceToken) : null,
            input.uploadToken !== undefined,
            input.referenceToken !== undefined,
        ]
    );
}

export async function clearCdnAccount(tenantId: string): Promise<void> {
    await query('DELETE FROM cdn_accounts WHERE tenant_id = $1', [tenantId]);
}

// ── Serving ──────────────────────────────────────────────────────────────────


/**
 * Whether this salon may be served this path.
 *
 * Her own folder is hers by definition. The shared folder is the awkward one:
 * it holds the images of every salon that existed before this table, so being
 * in it proves nothing about who owns what. There, the salon has to be shown to
 * actually reference the file — which her own rows say, and which another
 * salon's rows cannot say for her.
 */
export async function mayServe(
    tenantId: string,
    account: CdnAccount,
    slug: string,
    path: string
): Promise<boolean> {
    if (slug === account.slug) return true;
    if (slug !== env.cdn.sharedSlug) return false;

    // Whatever spelling the row happens to hold. The oldest ones store the
    // whole CDN URL, and missing that shape would break a salon's existing
    // photos on the exact day she is given a folder of her own.
    const candidates = storedSpellings(env.cdn.baseUrl, slug, path);
    const result = await query(
        `SELECT 1 FROM services
          WHERE tenant_id = $1 AND image_url = ANY($2::text[])
          UNION ALL
         SELECT 1 FROM staff
          WHERE tenant_id = $1 AND photo_url = ANY($2::text[])
          UNION ALL
         SELECT 1 FROM appointments
          WHERE tenant_id = $1
            AND (image_url = ANY($2::text[])
                 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(image_urls) AS u(v)
                             WHERE u.v = ANY($2::text[])))
          UNION ALL
         SELECT 1 FROM tenants
          WHERE id = $1
            AND (branding->>'logo_url' = ANY($2::text[])
                 OR branding->>'logo' = ANY($2::text[]))
          LIMIT 1`,
        [tenantId, candidates]
    );

    return result.rows.length > 0;
}

// ── Uploading ────────────────────────────────────────────────────────────────

/** Why an upload failed, in terms the caller can turn into a status code. */
export type UploadFailure = 'unconfigured' | 'unreachable' | 'rejected';

export class CdnError extends Error {
    constructor(readonly reason: UploadFailure, message: string) {
        super(message);
        this.name = 'CdnError';
    }
}

/**
 * Sends one image to the CDN under the salon's own key.
 *
 * The stored path comes back from the CDN rather than being assembled here: its
 * first segment is the folder the *key* belongs to, not anything the caller
 * asked for. That is precisely why a key per salon separates them, so the
 * answer is read rather than assumed.
 */
export async function uploadImage(
    account: CdnAccount,
    folder: string,
    bytes: Buffer,
    contentType: string,
    filename: string
): Promise<string> {
    const token = SYSTEM_FOLDERS.has(folder) ? account.uploadToken : account.referenceToken;
    if (!token) {
        throw new CdnError(
            'unconfigured',
            `No hay clave de CDN configurada para la carpeta "${folder}".`
        );
    }

    const body = new FormData();
    body.append('images', new Blob([new Uint8Array(bytes)], { type: contentType }), filename);
    body.append('folder', folder);

    let response: Response;
    try {
        response = await fetch(`${env.cdn.apiUrl}/api/images/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body,
            signal: AbortSignal.timeout(30_000),
        });
    } catch (error) {
        log.error('CDN unreachable during upload', { folder, ...errorContext(error) });
        throw new CdnError('unreachable', 'No pudimos contactar con el almacenamiento de imágenes.');
    }

    if (!response.ok) {
        // The CDN's body is never forwarded: some of its errors echo the key.
        log.error('CDN rejected the upload', {
            folder,
            status: response.status,
            slug: account.slug,
        });
        throw new CdnError('rejected', 'El almacenamiento de imágenes rechazó la subida.');
    }

    type Item = { url?: string; cdnUrl?: string; filename?: string };
    const payload = (await response.json().catch(() => null)) as {
        uploaded?: Item[];
        duplicates?: Item[];
    } | null;

    const item = payload?.uploaded?.[0] ?? payload?.duplicates?.[0];
    if (!item) {
        log.error('CDN response contained no file', { folder });
        throw new CdnError('rejected', 'El almacenamiento de imágenes no devolvió ningún archivo.');
    }

    const raw = item.url ?? item.cdnUrl ?? '';
    if (!raw) return [account.slug, folder, item.filename].filter(Boolean).join('/');

    try {
        return new URL(raw).pathname.replace(/^\/+/, '');
    } catch {
        return raw.replace(/^\/+/, '');
    }
}

/**
 * Confirms a key works and reports which folder it writes into.
 *
 * Worth its own call: finding out a key is wrong when a salon uploads her first
 * photo means finding out in front of her. And the folder it reports is the
 * thing that has to match what was typed — a key that works but writes
 * somewhere else puts her images where nothing will look for them.
 */
export async function probeToken(
    token: string
): Promise<{ ok: true; slug: string | null } | { ok: false; detail: string }> {
    let response: Response;
    try {
        response = await fetch(`${env.cdn.apiUrl}/api/images?limit=1`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        log.warn('CDN unreachable during probe', errorContext(error));
        return { ok: false, detail: 'No pudimos contactar con el CDN.' };
    }

    if (response.status === 401 || response.status === 403) {
        return { ok: false, detail: 'El CDN rechazó esa clave.' };
    }
    if (!response.ok) {
        return { ok: false, detail: `El CDN respondió ${response.status}.` };
    }

    type Item = { url?: string; cdnUrl?: string };
    const payload = (await response.json().catch(() => null)) as {
        images?: Item[];
        items?: Item[];
    } | null;

    const sample = payload?.images?.[0] ?? payload?.items?.[0];
    const raw = sample?.url ?? sample?.cdnUrl ?? '';

    let slug: string | null = null;
    if (raw) {
        try {
            slug = new URL(raw).pathname.replace(/^\/+/, '').split('/')[0] || null;
        } catch {
            slug = null;
        }
    }

    return { ok: true, slug };
}
