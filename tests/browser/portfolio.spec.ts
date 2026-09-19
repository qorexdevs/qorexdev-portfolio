import { test, expect } from '@playwright/test';

test('visitor can discover a case and open its working demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('работают');
  await page.getByRole('link', { name: 'Кейс FlowDesk' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('FlowDesk');
  await expect(page.getByText('Демонстрационный проект', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Открыть FlowDesk' }).first().click();
  await expect(page).toHaveURL(/\/demo\/flowdesk/);
});

test('all three cases are reachable and contacts preserve requested targets', async ({ page }) => {
  await page.goto('/');
  for (const [label, url] of [
    ['Kwork', 'https://kwork.ru/user/qorexdev'],
    ['Telegram', 'https://t.me/qorexdev'],
    ['FL.ru', 'https://www.fl.ru/users/qorexdevmail'],
  ]) {
    await expect(page.getByRole('link', { name: label, exact: true }).first()).toHaveAttribute(
      'href',
      url,
    );
  }
  for (const slug of ['flowdesk', 'orderly', 'pricewatch']) {
    await page.goto(`/work/${slug}`);
    await expect(page.getByRole('heading', { name: 'Технические решения' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Границы демоверсии' })).toBeVisible();
  }
});

test('unknown route has a clear way home', async ({ page }) => {
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('не найдена');
  await page.getByRole('link', { name: 'На главную' }).click();
  await expect(page).toHaveURL('/');
});
