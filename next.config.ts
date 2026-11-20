import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  serverExternalPackages: ['sharp'],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
