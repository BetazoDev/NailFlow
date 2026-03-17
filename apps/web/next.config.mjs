import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Real backend API URL — used for server-side rewrites only
// IMPORTANT: NEXT_PUBLIC_API_URL in Dokploy is incorrectly set to the frontend URL.
// We use BACKEND_API_URL (no NEXT_PUBLIC prefix) for the real backend,
// falling back to api.diabolicalservices.tech.
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://api.diabolicalservices.tech';

/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Proxy all /api/* calls to the real backend, EXCEPT /api/img/* which is handled
  // locally in Next.js (image proxy route) to keep CDN tokens server-side.
  async rewrites() {
    return [
      {
        // /api/img/* is handled by Next.js route handler — do NOT proxy it
        source: '/api/img/:path*',
        destination: '/api/img/:path*',  // no-op, keeps it local
      },
      {
        // All other /api/* calls go to the real Express backend
        source: '/api/:path*',
        destination: `${BACKEND_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
