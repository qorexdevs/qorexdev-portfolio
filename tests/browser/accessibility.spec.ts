import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of [
  '/',
  '/work/flowdesk',
  '/work/orderly',
  '/work/pricewatch',
  '/demo/flowdesk',
  '/demo/orderly',
  '/demo/pricewatch',
]) {
  test(`accessible and responsive ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    if (route.startsWith('/demo'))
      await expect(page.getByLabel('Демонстрационная роль')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    for (const width of [1440, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `horizontal overflow at ${width}`,
      ).toBe(true);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
}
