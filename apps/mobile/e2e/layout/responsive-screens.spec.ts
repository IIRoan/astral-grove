import { expect, test, type Page } from '@playwright/test';
import { auditLayout, findTabBarOverlaps, formatIssues } from '../helpers/layout-audit';
import { installMockApi } from '../helpers/mock-api';

const SEARCH_PLACEHOLDER = 'Search cards, artists, tags, or set numbers';

type ScreenCase = {
  name: string;
  path: string;
  /** Text or placeholder that proves the screen rendered. */
  ready: (page: Page) => Promise<void>;
};

const SCREENS: ScreenCase[] = [
  {
    name: 'cards catalog',
    path: '/search',
    ready: async (page) => {
      await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER).first()).toBeVisible();
    },
  },
  {
    name: 'collection',
    path: '/collection',
    ready: async (page) => {
      await expect(
        page.getByText('Collection Dashboard', { exact: true }).first()
      ).toBeVisible();
    },
  },
  {
    name: 'wishlist',
    path: '/wishlist',
    ready: async (page) => {
      await expect(page.getByText('Wishlist', { exact: true }).first()).toBeVisible();
    },
  },
  {
    name: 'decks',
    path: '/decks',
    ready: async (page) => {
      await expect(page.getByPlaceholder('Search your decks').first()).toBeVisible();
    },
  },
  {
    name: 'deck browse',
    path: '/decks/browse',
    ready: async (page) => {
      await expect(
        page.getByPlaceholder('Search decks, legends, or tags').first()
      ).toBeVisible();
    },
  },
  {
    name: 'deck editor',
    path: '/decks/deck-0?mode=edit',
    ready: async (page) => {
      await expect(
        page.getByPlaceholder('Search main deck cards').first()
      ).toBeVisible();
    },
  },
  {
    name: 'deck view',
    path: '/decks/deck-0',
    ready: async (page) => {
      await expect(page.getByLabel('Edit deck').first()).toBeVisible();
    },
  },
  {
    name: 'play',
    path: '/play',
    ready: async (page) => {
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForTimeout(1_500);
    },
  },
  {
    name: 'settings',
    // Deep-linking /settings resets to the catalog during boot, so open it through the shell.
    path: '/search',
    ready: async (page) => {
      await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER).first()).toBeVisible();
      const tab = page.getByRole('tab', { name: 'Settings', exact: true });
      if (await tab.isVisible()) {
        await tab.click();
      } else {
        await page.getByLabel(/^Account: .*Open settings$/).click();
      }
      await expect(
        page.getByText('Shared collection', { exact: true }).first()
      ).toBeVisible();
    },
  },
];

async function settle(page: Page) {
  // Let fonts, onLayout measurement and entrance motion finish before measuring.
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(1_200);
}

test.describe('responsive layout — nothing cut off', () => {
  test.beforeEach(async ({ context }) => {
    await installMockApi(context);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} fits the viewport`, async ({ page }, testInfo) => {
      await page.goto(screen.path, { timeout: 150_000, waitUntil: 'domcontentloaded' });
      await screen.ready(page);
      await settle(page);

      await page.screenshot({
        path: testInfo.outputPath(`${screen.name.replace(/\s+/g, '-')}.png`),
      });

      const issues = await auditLayout(page);
      expect(
        issues,
        `layout issues on ${screen.name}:\n${formatIssues(issues)}`
      ).toEqual([]);

      const overlaps = await findTabBarOverlaps(page);
      expect(overlaps, `controls covering the tab bar on ${screen.name}`).toEqual([]);
    });
  }

  test('primary navigation is fully on screen', async ({ page }) => {
    await page.goto('/search', { timeout: 150_000, waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER).first()).toBeVisible();
    await settle(page);

    const viewport = page.viewportSize()!;
    const tabs = page.getByRole('tab', {
      name: /^(Cards|Collection|Wishlist|Decks|Play)/,
    });
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      if (!(await tab.isVisible())) continue;
      const box = (await tab.boundingBox())!;
      expect(box.x, 'tab left edge').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'tab right edge').toBeLessThanOrEqual(
        viewport.width + 1
      );
      expect(box.y, 'tab top edge').toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, 'tab bottom edge').toBeLessThanOrEqual(
        viewport.height + 1
      );
      // Touch targets stay tappable even at 320pt with six tabs.
      expect(box.width).toBeGreaterThanOrEqual(36);
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe('layout audit self-check', () => {
  test('detects controls pushed past the edge or clipped', async ({ page }) => {
    await page.setContent(`
      <div style="width:100vw;overflow:hidden;display:flex">
        <div style="display:flex;flex-shrink:0;width:200vw">
          <button aria-label="fits" style="width:40px">a</button>
          <div style="flex:1"></div>
          <button aria-label="clipped-by-row" style="width:40px">b</button>
        </div>
      </div>
      <button aria-label="offscreen" style="position:fixed;left:calc(100vw - 10px);top:0;width:60px">c</button>
      <div style="overflow-x:auto;width:100vw"><div style="width:300vw"><button aria-label="scrollable-ok">d</button></div></div>
    `);
    const issues = await auditLayout(page);
    const labels = issues.map((i) => i.label);
    expect(labels).toContain('clipped-by-row');
    expect(labels).toContain('offscreen');
    expect(labels).not.toContain('fits');
    expect(labels).not.toContain('scrollable-ok');
  });
});
