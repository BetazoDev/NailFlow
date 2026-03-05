/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  output: "export",
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

