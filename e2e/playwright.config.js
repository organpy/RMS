const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  retries: 1,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5000,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: './frontend',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ]
});
