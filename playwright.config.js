import { defineConfig, devices } from '@playwright/test';
import { origin } from './scripts/cabinet.mjs';

export default defineConfig({
  testDir: './tests',
  testMatch: 'cabinet.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: origin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node scripts/serve-compat.mjs',
    url: `${origin}/health`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
});
