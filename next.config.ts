import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  distDir: process.env.NEXT_BUILD_DIR ?? '.next',
  devIndicators: false,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};
export default config;
