import { NextResponse } from 'next/server';

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

        const token = projectType === 'clients'
            // In a real production deployment, these would only be from process.env
            // and the fallback would not exist. Keeping it temporarily for transition.
            ? process.env.CDN_CLIENTS_TOKEN || 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW' 
            : process.env.CDN_DEMO_TOKEN || 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';

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
        console.log(`CDN Upload Success for ${projectType}:`, data);
        return NextResponse.json(data);
    } catch (e: any) {
        console.error('Proxy upload error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
