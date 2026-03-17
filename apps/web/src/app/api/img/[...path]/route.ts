import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-only CDN token — never sent to the browser
const CDN_DEMO_TOKEN = process.env.CDN_DEMO_TOKEN
    || process.env.CDN_UPLOAD_TOKEN
    || 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';

const CDN_CLIENTS_TOKEN = process.env.CDN_CLIENTS_TOKEN
    || 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const pathSegments = params.path; // e.g. ["nailssalon", "photo.jpg"]
    if (!pathSegments || pathSegments.length === 0) {
        return NextResponse.json({ error: 'No image path provided' }, { status: 400 });
    }

    const cdnPath = pathSegments.join('/'); // "nailssalon/photo.jpg"

    // Choose the right token based on the slug
    const slug = pathSegments[0] || '';
    const token = slug === 'clients' ? CDN_CLIENTS_TOKEN : CDN_DEMO_TOKEN;

    const cdnUrl = `https://cdn.diabolicalservices.tech/${cdnPath}?api_key=${token}`;

    try {
        const cdnRes = await fetch(cdnUrl, {
            // Don't follow redirect loops
            redirect: 'follow',
        });

        if (!cdnRes.ok) {
            console.error(`[Image Proxy] CDN returned ${cdnRes.status} for: ${cdnPath}`);
            return NextResponse.json(
                { error: `Image not found: ${cdnRes.status}` },
                { status: cdnRes.status }
            );
        }

        const buffer = await cdnRes.arrayBuffer();
        const contentType = cdnRes.headers.get('content-type') || 'image/jpeg';

        return new NextResponse(Buffer.from(buffer), {
            status: 200,
            headers: {
                'Content-Type': contentType,
                // Cache aggressively — images don't change (content-addressed filenames)
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (e: any) {
        console.error('[Image Proxy] Fetch error:', e.message);
        return NextResponse.json({ error: 'Failed to fetch image from CDN' }, { status: 502 });
    }
}
