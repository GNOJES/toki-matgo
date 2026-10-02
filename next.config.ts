import type { NextConfig } from 'next';
const config: NextConfig = {
  async headers() {
    return ['/sw.js', '/card-assets.json', '/cards/:path*'].map((source) => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
    }));
  },
  output: 'standalone',
  distDir: process.env.NEXT_BUILD_DIR ?? '.next',
  devIndicators: false,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};
export default config;
