import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-production',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3003',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'PORT=3003 npm start',
    url: 'http://127.0.0.1:3003',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
