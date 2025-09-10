// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Only needed if you still want to skip lint on Vercel builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
