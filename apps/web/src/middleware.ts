import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
    ],
};

export default function middleware(req: NextRequest) {
    const url = req.nextUrl;

    // Get hostname from request headers
    let hostname = req.headers.get("host") || "";

    // Clean hostname for local development
    hostname = hostname.replace('localhost:3000', 'demo.com');

    // Define main domains that shouldn't be rewritten
    const mainDomains = [
        'demo.com',
        'nailflow.com',
        'www.nailflow.com',
        'admin.nailflow.com',
        'nail-demo-35d0a.web.app',
        'nail-demo-35d0a.firebaseapp.com'
    ];

    // If it's a main domain or they are accessing /admin
    if (mainDomains.includes(hostname) || url.pathname.startsWith('/admin') || url.pathname.startsWith('/login')) {
        return NextResponse.next();
    }

    // It's a custom tenant domain!
    // Rewrite everything to `/[domain]${url.pathname}`
    return NextResponse.rewrite(new URL(`/${hostname}${url.pathname}`, req.url));
}
