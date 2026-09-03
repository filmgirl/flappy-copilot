import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'smoke.spec.js',
  forbidOnly: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 150_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
