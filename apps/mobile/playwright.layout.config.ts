import { defineConfig } from '@playwright/test';

/**
 * Responsive layout specs: offline (mock API), no backend or DB needed.
 * Chromium with per-device viewports/touch — WebKit isn't required to catch clipping and overflow.
 */
const WEB_PORT = process.env.UI_E2E_WEB_PORT ?? '7011';
const WEB_URL = process.env.UI_E2E_WEB_URL ?? `http://localhost:${WEB_PORT}`;

type Viewport = {
  name: string;
  width: number;
  height: number;
  touch: boolean;
};

const LAYOUT_VIEWPORTS: Viewport[] = [
  { name: 'iphone-se-1st-320', width: 320, height: 568, touch: true },
  { name: 'iphone-se-375', width: 375, height: 667, touch: true },
  { name: 'iphone-15-393', width: 393, height: 852, touch: true },
  { name: 'phone-landscape-667', width: 667, height: 375, touch: true },
  { name: 'ipad-slide-over-320', width: 320, height: 1024, touch: true },
  { name: 'ipad-split-507', width: 507, height: 1024, touch: true },
  { name: 'ipad-portrait-820', width: 820, height: 1180, touch: true },
  { name: 'ipad-landscape-1180', width: 1180, height: 820, touch: true },
  { name: 'desktop-1024', width: 1024, height: 700, touch: false },
  { name: 'desktop-1440', width: 1440, height: 900, touch: false },
];

export default defineConfig({
  testDir: './e2e/layout',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: './test-results/layout',
  use: {
    baseURL: WEB_URL,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: LAYOUT_VIEWPORTS.map((vp) => ({
    name: vp.name,
    use: {
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.touch,
      hasTouch: vp.touch,
      deviceScaleFactor: vp.touch ? 2 : 1,
    },
  })),
  webServer: {
    command: `bunx expo start --web --port ${WEB_PORT}`,
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    cwd: __dirname,
  },
});
