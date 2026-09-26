import { test, expect } from '@playwright/test';

test('FlowDesk opens the request workspace', async ({ page }) => {
  await page.goto('/demo/flowdesk');
  await expect(page.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
});
test('Orderly opens a usable coffee catalog', async ({ page }) => {
  await page.goto('/demo/orderly');
  await expect(page.getByRole('heading', { name: 'Кофе. И хороший день.' })).toBeVisible();
});
test('Orderly checkout works when randomUUID is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'randomUUID', { value: undefined });
  });
  await page.goto('/demo/orderly');
  await page.getByRole('button', { name: 'Добавить Флэт уайт', exact: true }).click();
  await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
  await page.getByLabel('Ваше имя').fill('Тестовый покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 000 000-00-00');
  await page.getByRole('button', { name: 'Подтвердить тестовый заказ' }).click();
  await expect(page.getByRole('heading', { name: 'Ваши заказы' })).toBeVisible();
});
test('PriceWatch opens persistent server monitoring', async ({ page }) => {
  await page.goto('/demo/pricewatch');
  await expect(page.getByRole('heading', { name: 'Цены под наблюдением' })).toBeVisible();
});

test('FlowDesk request survives reload, moves stage and keeps a comment', async ({ page }) => {
  await page.goto('/demo/flowdesk');
  await page.getByRole('button', { name: 'Новая заявка', exact: true }).click();
  await page.getByLabel('Название заявки').fill('Проверить резервную копию');
  await page
    .getByLabel('Описание', { exact: true })
    .fill('Синтетический сценарий проверки сохранения.');
  await page.getByLabel('Стоимость, ₽').fill('4500');
  await page.getByRole('button', { name: 'Создать заявку', exact: true }).click();
  const ticket = page
    .locator('.flow-ticket')
    .filter({ has: page.getByRole('button', { name: 'Проверить резервную копию', exact: true }) });
  await expect(ticket).toBeVisible();
  await ticket.getByRole('combobox').selectOption('progress');
  await expect(page.getByRole('status')).toContainText('Статус заявки сохранен');
  await ticket.getByRole('button', { name: 'Проверить резервную копию', exact: true }).click();
  await page
    .getByLabel('Комментарий', { exact: true })
    .fill('Копия восстановлена на тестовом стенде.');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(
    page.getByText('Копия восстановлена на тестовом стенде.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Проверить резервную копию', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('combobox', { name: 'Статус', exact: true }),
  ).toHaveValue('progress');
  await expect(page.getByLabel('Стоимость, ₽')).toHaveValue('4500');
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Описание', exact: true }),
  ).toHaveValue('Синтетический сценарий проверки сохранения.');
  await expect(
    page.getByText('Копия восстановлена на тестовом стенде.', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Демонстрационная роль').selectOption('manager');
  await expect(page.getByRole('status')).toContainText('роль изменена');
  await page.getByRole('button', { name: 'Проверить резервную копию', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Удалить заявку' })).toHaveCount(0);
});

test('FlowDesk creates a client and explains empty search results', async ({ page }) => {
  await page.goto('/demo/flowdesk');
  await page.getByRole('button', { name: /Клиенты/ }).click();
  await page.getByRole('button', { name: 'Добавить клиента', exact: true }).click();
  await page.getByLabel('Имя клиента').fill('Тестовый контакт');
  await page.getByLabel('Компания', { exact: true }).fill('Тестовая мастерская');
  await page.getByLabel('Email', { exact: true }).fill('test@example.test');
  await page.getByLabel('Телефон клиента').fill('+7 000 111-22-33');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Добавить клиента', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Тестовый контакт' })).toBeVisible();
  await page.getByLabel('Поиск клиентов').fill('абсолютнонеизвестныйклиент');
  await expect(page.getByRole('heading', { name: 'Клиенты не найдены' })).toBeVisible();
});

test('server failure is explained and the visitor can retry', async ({ page }) => {
  await page.route('**/api/state', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Тестовый сервер временно недоступен', code: 'UNAVAILABLE' }),
    }),
  );
  await page.goto('/demo/flowdesk');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить демо' })).toBeVisible();
  await page.unroute('**/api/state');
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
});

test('Orderly checkout persists and admin changes the order status', async ({ page }) => {
  await page.goto('/demo/orderly');
  await page.getByRole('button', { name: 'Добавить Флэт уайт', exact: true }).click();
  await expect(page.locator('.orderly-cart')).toContainText('290');
  await page.reload();
  await expect(page.locator('.orderly-cart')).toContainText('Флэт уайт');
  await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
  await page.getByLabel('Ваше имя').fill('Тестовый покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 000 000-00-00');
  await page.getByLabel('Комментарий к заказу').fill('Проверка сценария заказа');
  await page.getByRole('button', { name: 'Подтвердить тестовый заказ' }).click();
  await expect(page.getByRole('heading', { name: 'Ваши заказы' })).toBeVisible();
  await expect(
    page.locator('.orderly-order').filter({ hasText: 'Тестовый покупатель' }),
  ).toContainText('Принят');
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  const order = page.locator('.orderly-order').filter({ hasText: 'Тестовый покупатель' });
  await order.getByRole('combobox').selectOption('preparing');
  await expect(order).toContainText('Готовится');
  await page.getByRole('button', { name: /^Заказы/ }).click();
  await expect(
    page.locator('.orderly-order').filter({ hasText: 'Тестовый покупатель' }),
  ).toContainText('Готовится');
  await page.reload();
  await page.getByRole('button', { name: /^Заказы/ }).click();
  await expect(
    page.locator('.orderly-order').filter({ hasText: 'Тестовый покупатель' }),
  ).toContainText('Готовится');
});

test('Orderly admin can create a product and remove it from the menu', async ({ page }) => {
  await page.goto('/demo/orderly');
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await page.getByLabel('Название товара').fill('Тестовый раф');
  await page.getByLabel('Описание товара').fill('Кофе для демонстрационного сценария');
  await page.getByLabel('Цена, ₽').fill('350');
  await page.getByRole('dialog').getByRole('button', { name: 'Добавить товар' }).click();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Тестовый раф' })).toBeVisible();
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await page.getByRole('button', { name: 'Изменить Тестовый раф' }).click();
  await page.getByLabel('Доступен в меню').uncheck();
  await page.getByRole('button', { name: 'Сохранить товар' }).click();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Тестовый раф' })).toHaveCount(0);
});

test('PriceWatch adds a watch, saves threshold, records a check and creates an alert', async ({
  page,
}) => {
  await page.goto('/demo/pricewatch');
  await page.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await page.getByLabel('Товар из тестового каталога').selectOption('speaker');
  await page.getByRole('dialog').getByLabel('Уведомить при цене, ₽').fill('10000');
  await page.getByRole('button', { name: 'Начать наблюдение' }).click();
  await expect(
    page.locator('.pricewatch-detail').getByRole('heading', { name: 'Колонка Sound Mini' }),
  ).toBeVisible();
  await page.getByLabel('Уведомить при цене, ₽', { exact: true }).fill('11000');
  await page.getByRole('button', { name: 'Сохранить порог' }).click();
  await expect(page.getByRole('status')).toContainText('Порог сохранен');
  await page.getByRole('button', { name: 'Проверить сейчас' }).click();
  await expect(page.getByRole('status')).toContainText('Цена проверена');
  await page.getByText('История проверок в таблице', { exact: false }).click();
  await expect(page.getByRole('cell', { name: 'Ручная проверка' }).first()).toBeVisible();
  await page.getByRole('button', { name: /^События/ }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Колонка Sound Mini' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Отметить все прочитанными' }).click();
  await expect(page.getByRole('button', { name: 'Отметить все прочитанными' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: /Колонка Sound Mini/ }).click();
  await expect(page.getByLabel('Уведомить при цене, ₽', { exact: true })).toHaveValue('11000');
});

test('demo reset is explicit and returns this visitors initial data', async ({ page }) => {
  await page.goto('/demo/orderly');
  await page.getByRole('button', { name: 'Добавить Флэт уайт', exact: true }).click();
  await expect(page.locator('.orderly-cart')).toContainText('Флэт уайт');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Сбросить демо' }).click();
  await expect(page.getByText('Начнем с любимого?', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Начнем с любимого?', { exact: true })).toBeVisible();
});

test('mobile Orderly checkout works with touch-sized navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/orderly');
  await page.getByRole('button', { name: 'Добавить Флэт уайт', exact: true }).click();
  await page.getByRole('link', { name: /Корзина/ }).click();
  await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
  await page.getByLabel('Ваше имя').fill('Мобильный тест');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 000 222-22-22');
  await page.getByRole('button', { name: 'Подтвердить тестовый заказ' }).click();
  await expect(page.getByRole('heading', { name: 'Ваши заказы' })).toBeVisible();
  await expect(page.locator('.orderly-order').filter({ hasText: 'Мобильный тест' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('Telegram Orderly keeps its own navigation and role control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/orderly#tgWebAppData=test');
  await expect(page.getByRole('heading', { name: 'Кофе. И хороший день.' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('a[href="/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/work/"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Сбросить демо' })).toHaveCount(0);
  const role = page.getByRole('combobox', { name: 'Демонстрационная роль' });
  await expect(role).toBeVisible();
  await page.getByRole('button', { name: 'Добавить Флэт уайт', exact: true }).click();
  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(role).toBeVisible();
  await page.reload();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(role).toBeVisible();
  await role.selectOption('manager');
  await expect(role).toHaveValue('manager');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('browser Orderly keeps portfolio controls after a Telegram session', async ({ page }) => {
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.session.mode = 'telegram';
    await route.fulfill({ response, json: state });
  });
  await page.goto('/demo/orderly');
  await expect(page.getByRole('heading', { name: 'Кофе. И хороший день.' })).toBeVisible();
  await expect(page.locator('.demo-banner')).toBeVisible();
  await expect(page.locator('a[href="/"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сбросить демо' })).toBeVisible();
});

test('browser Orderly error offers a way back to the portfolio', async ({ page }) => {
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.orderly = null;
    await route.fulfill({ response, json: state });
  });
  await page.goto('/demo/orderly');
  await expect(page.getByRole('heading', { name: 'Не удалось открыть страницу' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
});

test('PriceWatch explains the empty list and can restart observation', async ({ page }) => {
  await page.goto('/demo/pricewatch');
  page.on('dialog', (dialog) => dialog.accept());
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /^Удалить наблюдение/ }).click();
    await expect(page.locator('.pricewatch-watch')).toHaveCount(2 - i);
  }
  await expect(page.getByRole('heading', { name: 'Начните с первой покупки' })).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать товар', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('PriceWatch default background interval works after leaving its screen', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto('/demo/pricewatch');
  await expect(page.getByLabel('Демонстрационная роль')).toBeVisible();
  const state = await page.request.get('/api/state').then((r) => r.json());
  const watchId = state.pricewatch.watches[0].id;
  const before = state.pricewatch.watches[0].history.length;
  await page.goto('/');
  await expect
    .poll(
      async () => {
        const next = await page.request.get('/api/state').then((r) => r.json());
        return next.pricewatch.watches.find((w: { id: string }) => w.id === watchId).history.length;
      },
      { timeout: 37000, intervals: [4000] },
    )
    .toBeGreaterThan(before);
});
