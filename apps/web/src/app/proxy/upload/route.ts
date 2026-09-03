import { NextResponse } from 'next/server';

/**
 * Server-side upload proxy.
 *
 * The CDN key lives here and never reaches the browser. Two other things matter
 * as much as hiding the key:
 *
 *   - **Who may upload.** Salon-managed folders require a signed-in user;
 *     without that check the route is an open file host running on someone
 *     else's storage quota.
 *   - **What may be uploaded.** Type and size are validated before the file is
 *     forwarded, so the CDN only ever receives images of a sane size.
 */

const CDN_API_URL = process.env.CDN_API_URL ?? 'https://api.diabolicalservices.tech';
const CDN_SYSTEM_TOKEN = process.env.CDN_UPLOAD_TOKEN;
const CDN_REFERENCE_TOKEN = process.env.CDN_API_KEY_REFERENCES;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Folders the salon manages. Everything else is a client reference photo. */
const SYSTEM_FOLDERS = new Set(['services', 'team', 'staff', 'branding', 'profile']);
const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Verifies the caller's Firebase ID token against Google's public endpoint.
 *
 * The full Admin SDK is deliberately not pulled into the Next.js runtime for
 * this one check; the token endpoint tells us whether the token is valid, which
 * is all this route needs to decide.
 */
async function isSignedIn(request: Request): Promise<boolean> {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return false;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return false;

    try {
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: header.slice('Bearer '.length) }),
                signal: AbortSignal.timeout(5_000),
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    }

    const file = formData.get('image');
    const folder = String(formData.get('folder') ?? 'references');

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!FOLDER_PATTERN.test(folder)) {
        return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
            { error: 'Only JPEG, PNG, WebP and AVIF images are accepted' },
            { status: 415 }
        );
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Images must be 8 MB or smaller' }, { status: 413 });
    }

    const isSystemFolder = SYSTEM_FOLDERS.has(folder);

    // Clients upload reference photos anonymously mid-booking; anything that
    // changes what the salon itself displays requires a signed-in user.
    if (isSystemFolder && !(await isSignedIn(request))) {
        return NextResponse.json({ error: 'Sign in to upload to this folder' }, { status: 401 });
    }

    const token = isSystemFolder ? CDN_SYSTEM_TOKEN : CDN_REFERENCE_TOKEN;
    if (!token) {
        console.error('[upload] CDN token is not configured for folder', folder);
        return NextResponse.json({ error: 'Image storage is not configured' }, { status: 503 });
    }

    const outbound = new FormData();
    outbound.append('images', file);
    outbound.append('folder', folder);

    let response: Response;
    try {
        response = await fetch(`${CDN_API_URL}/api/images/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: outbound,
            signal: AbortSignal.timeout(30_000),
        });
    } catch (error) {
        console.error('[upload] CDN unreachable', error);
        return NextResponse.json({ error: 'Image storage is unreachable' }, { status: 502 });
    }

    if (!response.ok) {
        // Never forward the CDN's body: it can echo the key back in an error.
        console.error('[upload] CDN rejected the upload', { status: response.status, folder });
        return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    const payload = await response.json().catch(() => null);
    const item = payload?.uploaded?.[0] ?? payload?.duplicates?.[0];

    if (!item) {
        console.error('[upload] CDN response contained no file');
        return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    // Return a bare path, never the CDN URL with its key. The browser renders it
    // through the API's image proxy.
    const rawUrl: string = item.url ?? item.cdnUrl ?? '';
    const path = rawUrl
        ? new URL(rawUrl).pathname.replace(/^\/+/, '')
        : [folder, item.filename].filter(Boolean).join('/');

    return NextResponse.json({ url: path });
}
