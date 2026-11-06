import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  serverExternalPackages: ['sharp'],
};
export default nextConfig;
