import { NextResponse } from 'next/server';

// Server-side CDN token — NEVER sent to the browser
const CDN_DEMO_TOKEN = process.env.CDN_DEMO_TOKEN || process.env.CDN_UPLOAD_TOKEN || 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const CDN_CLIENTS_TOKEN = process.env.CDN_CLIENTS_TOKEN || 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.diabolicalservices.tech';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const projectType = formData.get('projectType') || 'demo';
        const file = formData.get('images');
        const folder = formData.get('folder');
        
        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const outboundFormData = new FormData();
        outboundFormData.append('images', file);
        if (folder) {
            outboundFormData.append('folder', folder);
        }

        const token = projectType === 'clients' ? CDN_CLIENTS_TOKEN : CDN_DEMO_TOKEN;

        const uploadUrl = 'https://api.diabolicalservices.tech/api/images/upload';
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: outboundFormData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `CDN Upload Error: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();

        // ── Security: sanitize CDN URLs before returning to the browser ──────
        // Remove api_key from direct CDN URLs and use them directly since CDN is publicly readable
        const sanitize = (url: string | undefined) => {
            if (!url) return url;
            if (!url.includes('cdn.diabolicalservices.tech')) return url;
            try {
                const parsed = new URL(url);
                parsed.searchParams.delete('api_key');
                parsed.searchParams.delete('token');
                return parsed.toString();
            } catch {
                return url;
            }
        };

        if (data.uploaded) data.uploaded = data.uploaded.map((item: any) => ({ ...item, url: sanitize(item.url) }));
        if (data.duplicates) data.duplicates = data.duplicates.map((item: any) => ({ ...item, url: sanitize(item.url) }));

        console.log(`[Upload Proxy] Success for ${projectType}`);
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[Upload Proxy] Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
