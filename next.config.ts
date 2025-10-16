// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Skip lint errors during Vercel builds (optional)
    ignoreDuringBuilds: true,
  },

  async rewrites() {
    return [
      {
        source: '/ads.txt',
        destination: 'https://srv.adstxtmanager.com/19390/howmanymics.com',
      },
    ];
  },
};

export default nextConfig;
