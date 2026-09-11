import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { resolveTenant, tenantOf } from '../middleware/tenant';
import { requireTenantOwner } from '../middleware/auth';
import { createLogger, errorContext } from '../lib/logger';
import {
    CdnError,
    FOLDER_PATTERN,
    SYSTEM_FOLDERS,
    cdnFor,
    mayServe,
    resolveImagePath,
    uploadImage,
} from '../services/cdn';

const log = createLogger('images');
export const imagesRouter: Router = Router();

/**
 * Reading and writing a salon's images.
 *
 * Both directions are scoped to the salon the request arrived for, resolved
 * from the Host header — never from anything the browser asks for. Before that
 * was true, the read proxy served whatever path it was given with a key that
 * could read everything, so one salon's page could serve another salon's
 * client photos to anyone who knew a filename.
 *
 * The CDN key never leaves the server in either direction.
 */

const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const MAX_PATH_SEGMENTS = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Rejects anything that is not a plain relative path.
 *
 * Without this a request like `/api/img/x/../../admin?` would let a caller
 * reshape the outbound URL and use this endpoint — which holds a valid key —
 * to read whatever else the CDN serves.
 */
function safePath(raw: string): string | null {
    const segments = raw.replace(/^\/+/, '').split('/').filter(Boolean);
    if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) return null;
    for (const segment of segments) {
        if (segment === '.' || segment === '..' || !SEGMENT_PATTERN.test(segment)) return null;
    }
    return segments.join('/');
}

// ── Reading ──────────────────────────────────────────────────────────────────

imagesRouter.get(
    '/img/*',
    resolveTenant,
    asyncHandler(async (req, res) => {
        const { id: tenantId } = tenantOf(req);
        const raw = (req.params as Record<string, string>)[0] ?? '';

        const path = safePath(raw);
        if (!path) throw ApiError.badRequest('Invalid image path');

        const account = await cdnFor(tenantId);

        const resolved = resolveImagePath(account.slug, env.cdn.sharedSlug, path);
        if (!resolved) throw ApiError.badRequest('Invalid image path');
        const { slug, rest } = resolved;

        if (!(await mayServe(tenantId, account, slug, rest))) {
            // Deliberately the same answer as a missing file: telling a caller
            // that an image exists but belongs to someone else is itself a
            // disclosure, and confirms filenames worth guessing at.
            throw ApiError.notFound('Image not found');
        }

        const token = SYSTEM_FOLDERS.has(rest.split('/')[0])
            ? (account.uploadToken ?? account.referenceToken)
            : (account.referenceToken ?? account.uploadToken);

        if (!token) {
            log.error('No CDN token available for this salon', { tenantId, slug });
            throw new ApiError(503, 'Image storage is not configured');
        }

        const url = `${env.cdn.baseUrl}/${slug}/${rest}?api_key=${encodeURIComponent(token)}`;

        let upstream: Response;
        try {
            upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        } catch (error) {
            log.error('CDN request failed', { slug, path: rest, ...errorContext(error) });
            throw new ApiError(502, 'Image storage is unreachable');
        }

        if (!upstream.ok) throw ApiError.notFound('Image not found');

        const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
        // Only ever hand back images; the CDN answering with HTML would
        // otherwise become a same-origin injection vector.
        if (!contentType.startsWith('image/')) throw ApiError.notFound('Not an image');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(Buffer.from(await upstream.arrayBuffer()));
    })
);

// ── Writing ──────────────────────────────────────────────────────────────────

/**
 * The image arrives as a raw body rather than multipart.
 *
 * The web app has already parsed the browser's form, checked the type and the
 * size, and has nothing left to add; forwarding the bytes means this service
 * never has to parse multipart, and the upload can live where the salon's
 * sealed key and her identity both already are.
 */
const rawImage = express.raw({ type: ALLOWED_TYPES, limit: MAX_BYTES });

/**
 * Uploads are the one thing here that costs storage.
 *
 * Reference photos are accepted from someone who is not signed in — that is the
 * point of them — so without a budget this endpoint is a free file host running
 * on the salon's quota. Reads are deliberately not limited: one booking page
 * can legitimately ask for a dozen images at once.
 */
const uploadLimit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas imágenes seguidas. Espera un momento.' },
});

function receive(folder: string) {
    return asyncHandler(async (req: express.Request, res: express.Response) => {
        const { id: tenantId } = tenantOf(req);

        if (!FOLDER_PATTERN.test(folder)) throw ApiError.badRequest('Invalid folder name');

        const bytes = req.body;
        if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
            throw ApiError.badRequest('No image provided');
        }

        const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim();
        if (!ALLOWED_TYPES.includes(contentType)) {
            throw new ApiError(415, 'Only JPEG, PNG, WebP and AVIF images are accepted');
        }

        const filename = String(req.query.filename ?? 'upload')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .slice(0, 100);

        const account = await cdnFor(tenantId);

        try {
            const path = await uploadImage(account, folder, bytes, contentType, filename);
            res.json({ url: path });
        } catch (error) {
            if (error instanceof CdnError) {
                const status =
                    error.reason === 'unconfigured' ? 503 : error.reason === 'unreachable' ? 502 : 502;
                throw new ApiError(status, error.message);
            }
            throw error;
        }
    });
}

/**
 * Reference photos are uploaded mid-booking, by someone who is not signed in
 * and never will be. Everything else changes what the salon herself displays,
 * so it takes an owner — of *this* salon, which is the part a bare "is this
 * token valid" check could never establish.
 */
imagesRouter.post(
    '/images/references',
    uploadLimit,
    resolveTenant,
    rawImage,
    receive('references')
);

imagesRouter.post(
    '/images/:folder',
    uploadLimit,
    resolveTenant,
    ...requireTenantOwner,
    rawImage,
    asyncHandler(async (req, res, next) => {
        const folder = req.params.folder;
        if (!SYSTEM_FOLDERS.has(folder)) throw ApiError.badRequest('Invalid folder name');
        return receive(folder)(req, res, next);
    })
);
