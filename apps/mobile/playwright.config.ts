import { defineConfig, devices } from '@playwright/test';

/** UI e2e on Playwright Chromium + Expo web :7011; specs override API to :7000 (Metro inlines .env). Needs `bun run dev:api`. */
const WEB_PORT = process.env.UI_E2E_WEB_PORT ?? '7011';
const WEB_URL = process.env.UI_E2E_WEB_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Playwright's own Chromium (Chrome for Testing) — not system Chrome.
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Do not set channel: 'chrome' — that would use installed Google Chrome.
      },
    },
  ],
  webServer: {
    command: `bunx expo start --web --port ${WEB_PORT}`,
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    cwd: __dirname,
  },
});
