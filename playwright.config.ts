import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_URL || 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://127.0.0.1:3101/health',
        reuseExistingServer: false,
        timeout: 30000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
    },
  ],
});
