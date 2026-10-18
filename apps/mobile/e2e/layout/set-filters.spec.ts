import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { FilterSnapshot } from '@riftbound/contracts';
import { SET_DIRECTORY } from '../../constants/setDirectory';
import { installMockApi, MOCK_API_ORIGIN } from '../helpers/mock-api';

async function installSetFilters(
  context: BrowserContext,
  sets: FilterSnapshot['sets']
) {
  await installMockApi(context);
  await context.route(`${MOCK_API_ORIGIN}/api/v1/filters`, async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://localhost:7011',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      headers,
      json: {
        data: {
          sets,
          colors: [],
          types: [],
          supertypes: [],
          rarities: [],
          variants: [],
        },
        meta: {
          cachedAt: '2026-01-01T00:00:00.000Z',
          catalogHash: 'layout-hash',
          pricesCatalogHash: 'layout-price-hash',
          variantCount: 48,
        },
      },
    });
  });
}

async function openSetFilters(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  if (mobile) await page.locator('[aria-label="Open filters"]').click();
  await page.getByRole('button', { name: 'Sets', exact: true }).click();
}

function setControl(page: Page, code: string, name: string) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  return page.getByRole('checkbox', {
    name: mobile ? `${name} (${code})` : name,
    exact: true,
  });
}

for (const path of ['/search', '/decks/browse']) {
  test(`set dropdown grows and shrinks with special sets on ${path}`, async ({
    context,
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop popover');
    const width = page.viewportSize()!.width;
    await page.setViewportSize({ width, height: 1100 });
    await installSetFilters(
      context,
      SET_DIRECTORY.map((set) => ({ ...set, id: set.code, count: 10, printCount: 10 }))
    );
    await page.goto(path);
    await openSetFilters(page);
    const panel = page.getByTestId('filter-popover-content');
    const specialTrigger = page.getByRole('button', { name: /^Special sets/ });
    const height = () =>
      panel.evaluate((element) => element.getBoundingClientRect().height);
    await expect(panel).toHaveCSS('opacity', '1');
    const collapsedHeight = await height();

    await panel.evaluate((element) => {
      const observer = new MutationObserver(() => {
        const content = element.querySelector(
          '[data-testid="accordion-deferred-content"]'
        );
        if (!content) return;
        element.setAttribute(
          'data-prepared-hidden',
          String(
            getComputedStyle(content).opacity === '0' &&
              content.hasAttribute('inert') &&
              content.getAttribute('aria-hidden') === 'true'
          )
        );
        observer.disconnect();
      });
      observer.observe(element, { childList: true, subtree: true });
    });

    await specialTrigger.click();
    await expect(panel).toHaveAttribute('data-prepared-hidden', 'true');
    const content = page.getByTestId('accordion-deferred-content');
    await expect(content).toHaveCSS('opacity', '1');
    await expect(content).not.toHaveAttribute('inert');
    await expect(content.locator('..')).toHaveCSS('transform', 'none');
    await expect.poll(height).toBeGreaterThan(collapsedHeight + 200);
    for (const set of SET_DIRECTORY) {
      await expect(setControl(page, set.code, set.name)).toBeInViewport({ ratio: 1 });
    }
    await specialTrigger.click();
    await expect.poll(height).toBeLessThan(collapsedHeight + 2);

    // A short viewport still grows the panel, then scrolls the remaining options.
    await page.setViewportSize({ width, height: 700 });
    const shortCollapsedHeight = await height();
    await specialTrigger.click();
    await expect.poll(height).toBeGreaterThan(shortCollapsedHeight + 30);
    await expect(panel).toBeInViewport({ ratio: 1 });
    await setControl(page, 'VEN-NN', 'Vendetta | Nexus Night').click();
    await expect(setControl(page, 'VEN-NN', 'Vendetta | Nexus Night')).toBeChecked();
    await specialTrigger.click();
    await expect.poll(height).toBeLessThan(shortCollapsedHeight + 2);
    await expect(setControl(page, 'OGN', 'Origins')).toBeInViewport({ ratio: 1 });

    // Reversing a queued reveal must cancel its stale frames and exit timer.
    await specialTrigger.evaluate(async (element: HTMLElement) => {
      element.click();
      await new Promise(requestAnimationFrame);
      element.click();
      await new Promise(requestAnimationFrame);
      element.click();
    });
    await expect(specialTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(content).toHaveCSS('opacity', '1');
    await expect(content).not.toHaveAttribute('inert');
    await specialTrigger.click();
    await expect(content).toHaveCount(0);
    await expect.poll(height).toBeLessThan(shortCollapsedHeight + 2);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await openSetFilters(page);
    await specialTrigger.press('Enter');
    await expect.poll(height).toBeGreaterThan(shortCollapsedHeight + 30);
    await expect(panel.locator(':scope > div').first()).toHaveCSS(
      'transition-duration',
      '0s'
    );
  });
}

test('keeps mainline sets visible and preserves collapsed special selections', async ({
  context,
  page,
}) => {
  await installSetFilters(
    context,
    SET_DIRECTORY.map((set) => ({ ...set, id: set.code, count: 10, printCount: 10 }))
  );
  await page.goto('/search');
  await openSetFilters(page);

  for (const set of SET_DIRECTORY.filter((entry) => !entry.special)) {
    await expect(setControl(page, set.code, set.name)).toBeVisible();
  }
  const specialTrigger = page.getByRole('button', { name: /^Special sets/ });
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(specialTrigger).toBeInViewport({ ratio: 1 });
  }
  await expect(specialTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(setControl(page, 'ARC', 'Arcane Box Set')).toHaveCount(0);
  await expect(setControl(page, 'OGN-NN', 'Origins | Nexus Night')).toHaveCount(0);

  await setControl(page, 'OGN', 'Origins').click();
  await specialTrigger.click();
  for (const set of SET_DIRECTORY.filter((entry) => entry.special)) {
    await expect(setControl(page, set.code, set.name)).toBeVisible();
  }
  await setControl(page, 'ARC', 'Arcane Box Set').click();
  await specialTrigger.click();
  await expect(specialTrigger).toHaveAccessibleName('Special sets, 1 selected');
  await expect(specialTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(setControl(page, 'OGN', 'Origins')).toBeChecked();

  await specialTrigger.click();
  await expect(setControl(page, 'ARC', 'Arcane Box Set')).toBeChecked();
  await setControl(page, 'ARC', 'Arcane Box Set').click();
  await specialTrigger.click();
  await expect(specialTrigger).toHaveAccessibleName('Special sets');
  await expect(setControl(page, 'OGN', 'Origins')).toBeChecked();
});

test('omits the special section when only mainline sets are available', async ({
  context,
  page,
}) => {
  await installSetFilters(context, [
    { id: 'ogn', code: 'OGN', name: 'Origins', count: 48, printCount: 48 },
  ]);
  await page.goto('/search');
  await openSetFilters(page);
  await expect(setControl(page, 'OGN', 'Origins')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Special sets/ })).toHaveCount(0);
});

test('keeps the special section discoverable in deck set filters', async ({
  context,
  page,
}) => {
  await installSetFilters(
    context,
    SET_DIRECTORY.map((set) => ({ ...set, id: set.code, count: 10, printCount: 10 }))
  );
  await page.goto('/decks/browse');
  await openSetFilters(page);
  const specialTrigger = page.getByRole('button', { name: /^Special sets/ });
  await expect(specialTrigger).toHaveAttribute('aria-expanded', 'false');
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(specialTrigger).toBeInViewport({ ratio: 1 });
  }
  await expect(setControl(page, 'OGN', 'Origins')).toBeVisible();
  await expect(setControl(page, 'RAD', 'Radiance')).toBeVisible();
  await specialTrigger.click();
  await setControl(page, 'ARC', 'Arcane Box Set').click();
  await specialTrigger.click();
  await expect(specialTrigger).toHaveAccessibleName('Special sets, 1 selected');
});
