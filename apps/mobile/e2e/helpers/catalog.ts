import { expect, type Page } from '@playwright/test';

export async function selectCatalogFilter(page: Page, section: string, option: string) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  if (mobile) await page.locator('[aria-label="Open filters"]').click();
  const trigger = page.getByRole('button', {
    name: mobile ? new RegExp(`^${section}(?: |$)`) : section,
    exact: !mobile,
  });
  await expect(trigger).toBeVisible();
  const optionControl = page.getByRole('checkbox', { name: option, exact: true });
  if (!mobile || (await optionControl.count()) === 0) await trigger.click();
  await optionControl.click();
  if (mobile) await page.getByRole('button', { name: 'Filter', exact: true }).click();
  else await page.getByRole('button', { name: section, exact: true }).click();
}
