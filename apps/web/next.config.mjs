import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // Self-contained server bundle for the Docker image.
    output: 'standalone',
    experimental: {
        // Traces from the monorepo root so the standalone bundle picks up
        // workspace packages such as @nailflow/shared.
        outputFileTracingRoot: path.join(__dirname, '../../'),
    },

    // Images are served through the API's CDN proxy, which already sets
    // long-lived cache headers; Next's optimiser would only add a second hop.
    images: {
        unoptimized: true,
    },

    // Type and lint errors fail the build. They were previously ignored, which
    // meant a broken component could ship and only surface in the browser.
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: false,
    },

    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
};

export default nextConfig;
