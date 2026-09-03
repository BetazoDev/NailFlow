import { Router } from 'express';
import { env } from '../config/env';
import { ApiError, asyncHandler } from '../middleware/errors';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('images');
export const imagesRouter: Router = Router();

/**
 * Read-through proxy for CDN images.
 *
 * The CDN requires an API key on every read. Proxying keeps that key on the
 * server: the browser only ever sees `/api/img/<slug>/<path>`.
 *
 * Both the slug and the path are strictly validated. Without that, a request
 * like `/api/img/x/../../admin?` would let a caller reshape the outbound URL
 * and use this endpoint — which holds a valid key — to read anything the CDN
 * serves.
 */

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const MAX_PATH_SEGMENTS = 8;

function safePath(raw: string): string | null {
    const segments = raw.replace(/^\/+/, '').split('/');
    if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) return null;
    for (const segment of segments) {
        if (segment === '.' || segment === '..' || !SEGMENT_PATTERN.test(segment)) return null;
    }
    return segments.join('/');
}

/**
 * Which key to try first. System folders are written by the salon owner;
 * everything else (booking reference photos) lives under the client key.
 */
const SYSTEM_FOLDERS = ['services', 'team', 'staff', 'branding', 'profile'];

function tokenOrder(path: string): (string | undefined)[] {
    const isSystem = SYSTEM_FOLDERS.some(folder => path.startsWith(`${folder}/`) || path.includes(`/${folder}/`));
    return isSystem
        ? [env.cdn.systemToken, env.cdn.referenceToken]
        : [env.cdn.referenceToken, env.cdn.systemToken];
}

imagesRouter.get(
    '/img/:slug/*',
    asyncHandler(async (req, res) => {
        const slug = req.params.slug;
        const rawPath = (req.params as Record<string, string>)[0] ?? '';

        if (!SLUG_PATTERN.test(slug)) {
            throw ApiError.badRequest('Invalid image slug');
        }

        const path = safePath(rawPath);
        if (!path) {
            throw ApiError.badRequest('Invalid image path');
        }

        const tokens = tokenOrder(path).filter((token): token is string => Boolean(token));
        if (tokens.length === 0) {
            log.error('No CDN token configured; cannot serve images');
            throw new ApiError(503, 'Image storage is not configured');
        }

        for (const token of tokens) {
            const url = `${env.cdn.baseUrl}/${slug}/${path}?api_key=${encodeURIComponent(token)}`;
            let upstream: Response;

            try {
                upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
            } catch (error) {
                log.error('CDN request failed', { slug, path, ...errorContext(error) });
                throw new ApiError(502, 'Image storage is unreachable');
            }

            if (upstream.ok) {
                const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
                // Only ever hand back images; the CDN answering with HTML would
                // otherwise become a same-origin injection vector.
                if (!contentType.startsWith('image/')) {
                    throw ApiError.notFound('Not an image');
                }

                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.send(Buffer.from(await upstream.arrayBuffer()));
                return;
            }

            // 401/403/404 mean "wrong key for this folder" — try the other one.
            if (![401, 403, 404].includes(upstream.status)) {
                log.warn('CDN returned an error', { slug, path, status: upstream.status });
                break;
            }
        }

        throw ApiError.notFound('Image not found');
    })
);
