import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    // Optional installed browser for offline workstations (e.g. msedge).
    channel: process.env.EON_TEST_BROWSER || undefined,
    baseURL: 'http://localhost:31982',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start Eon local server in UI Dev Mode before running tests
  webServer: {
    command: 'node src/server/index.js --ui-dev-mode',
    url: 'http://localhost:31982/api/status',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
