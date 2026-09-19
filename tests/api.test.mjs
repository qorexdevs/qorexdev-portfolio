import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.mjs';

test('idempotency keys are opaque strings even when equal to an object property name', async () => {
  const f = await fixture();
  try {
    const initial = await f.state();
    await f.action('/api/orderly/cart', { productId: initial.orderly.products[0].id, quantity: 1 });
    const checkout = {
      name: 'Гость',
      phone: '+79990000000',
      note: '',
      idempotencyKey: 'hasOwnProperty',
    };
    const placed = await f.action('/api/orderly/checkout', checkout);
    assert.equal(placed.orderly.orders.length, initial.orderly.orders.length + 1);
    const duplicate = await f.action('/api/orderly/checkout', checkout);
    assert.equal(duplicate.orderly.orders.length, placed.orderly.orders.length);
  } finally {
    await f.close();
  }
});

test('unknown API paths do not allocate workspaces and creation has a separate IP budget', async () => {
  const f = await fixture({ newWorkspaceLimit: 1 });
  try {
    assert.equal((await f.request('/api/not-a-route')).response.status, 404);
    assert.equal(f.runtime.db.prepare('SELECT count(*) AS n FROM workspaces').get().n, 0);
    await f.state();
    const limited = await f.request('/api/state', undefined, 'b');
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.code, 'WORKSPACE_RATE');
    assert.equal((await f.request('/api/state')).response.status, 200);
    assert.equal(f.runtime.db.prepare('SELECT count(*) AS n FROM workspaces').get().n, 1);
  } finally {
    await f.close();
  }
});

test('sparse updates preserve ticket, client and unavailable product fields', async () => {
  const f = await fixture();
  try {
    const initial = await f.state();
    const ticket = initial.flowdesk.tickets.find((item) => item.priority === 'high');
    const moved = await f.action('/api/flowdesk/tickets/' + ticket.id + '/update', {
      status: 'progress',
    });
    const changed = moved.flowdesk.tickets.find((item) => item.id === ticket.id);
    assert.equal(changed.amount, ticket.amount);
    assert.equal(changed.priority, ticket.priority);
    assert.equal(changed.description, ticket.description);
    const client = initial.flowdesk.clients[0];
    const renamed = await f.action('/api/flowdesk/clients/' + client.id + '/update', {
      name: 'Новое имя',
    });
    assert.equal(renamed.flowdesk.clients[0].email, client.email);
    assert.equal(renamed.flowdesk.clients[0].phone, client.phone);
    assert.equal(renamed.flowdesk.clients[0].company, client.company);
    const product = initial.orderly.products[0];
    await f.action('/api/orderly/products/' + product.id + '/update', { available: false });
    const repriced = await f.action('/api/orderly/products/' + product.id + '/update', {
      price: 777,
    });
    assert.equal(repriced.orderly.products[0].available, false);
    assert.equal(repriced.orderly.products[0].description, product.description);
  } finally {
    await f.close();
  }
});

test('record byte budget rejects growth atomically while keeping the workspace usable', async () => {
  const f = await fixture({ maxWorkspaceBytes: 32000 });
  try {
    const initial = await f.state();
    const ticket = initial.flowdesk.tickets[0];
    let previousCount = ticket.comments.length;
    let capped = false;
    for (let index = 0; index < 35; index++) {
      const result = await f.request('/api/flowdesk/tickets/' + ticket.id + '/comments', {
        text: 'я'.repeat(1000),
      });
      if (result.response.status === 409) {
        assert.equal(result.body.code, 'WORKSPACE_SIZE');
        capped = true;
        break;
      }
      assert.equal(result.response.status, 200);
      previousCount++;
    }
    assert.ok(capped, 'large comments cannot exhaust storage or worker memory');
    assert.equal((await f.state()).flowdesk.tickets[0].comments.length, previousCount);
  } finally {
    await f.close();
  }
});

test('startup resumes persisted due checks and preserves private changes', async () => {
  const f = await fixture({ intervalSeconds: 0.09, workerPollMs: 5000 });
  let restarted;
  try {
    const initial = await f.state();
    await f.action('/api/flowdesk/clients', {
      name: 'Сохраненный клиент',
      company: '',
      email: '',
      phone: '',
    });
    f.runtime.close();
    await new Promise((resolve) => setTimeout(resolve, 120));
    restarted = createApp({ dbPath: f.dbPath, intervalSeconds: 0.09, workerPollMs: 5000 });
    const row = restarted.db.prepare('SELECT data FROM workspaces').get();
    const state = JSON.parse(row.data);
    assert.equal(state.flowdesk.clients.at(-1).name, 'Сохраненный клиент');
    assert.ok(
      state.pricewatch.watches[0].history.length > initial.pricewatch.watches[0].history.length,
    );
    assert.equal(state.pricewatch.watches[0].history.at(-1).source, 'background');
  } finally {
    restarted?.close();
    await f.close();
  }
});

async function fixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'qorexdev-api-'));
  const dbPath = join(directory, 'demo.sqlite');
  const runtime = createApp({ dbPath, ...options });
  const http = runtime.app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const origin = 'http://127.0.0.1:' + http.address().port;
  const cookies = new Map();
  async function request(path = '/api/state', data, client = 'a', extra = {}) {
    const headers = { ...(cookies.get(client) ? { Cookie: cookies.get(client) } : {}), ...extra };
    if (data !== undefined)
      Object.assign(
        headers,
        { 'Content-Type': 'application/json', 'X-Demo-Request': '1', Origin: origin },
        extra,
      );
    const response = await fetch(origin + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) cookies.set(client, cookie.split(';')[0]);
    const body = await response.json();
    return { response, body };
  }
  async function state(client = 'a') {
    const result = await request('/api/state', undefined, client);
    assert.equal(result.response.status, 200, 'a visitor can initialize the isolated workspace');
    return result.body;
  }
  async function action(path, data, client = 'a') {
    const result = await request(path, data, client);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    return result.body;
  }
  return {
    runtime,
    http,
    origin,
    request,
    state,
    action,
    cookies,
    dbPath,
    async close() {
      await new Promise((resolve) => http.close(resolve));
      runtime.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('visitor changes are persisted and isolated from another cookie', async () => {
  const f = await fixture();
  try {
    const first = await f.state();
    const second = await f.state('b');
    const added = await f.action('/api/flowdesk/clients', {
      name: 'Тестовый клиент',
      company: 'Сервис',
      email: 'test@example.test',
      phone: '+70000000000',
    });
    assert.equal(added.flowdesk.clients.length, first.flowdesk.clients.length + 1);
    assert.equal((await f.state('b')).flowdesk.clients.length, second.flowdesk.clients.length);
    assert.equal((await f.state()).flowdesk.clients.at(-1).name, 'Тестовый клиент');
    assert.match(f.cookies.get('a'), /^qorex_demo=/);
    const response = await f.request('/api/state', undefined, 'new');
    assert.match(response.response.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(response.response.headers.get('set-cookie'), /SameSite=Lax/i);
    assert.equal(response.response.headers.get('cache-control'), 'no-store');
    const db = new DatabaseSync(f.dbPath);
    assert.ok(db.prepare('SELECT count(*) AS n FROM workspaces').get().n >= 2);
    db.close();
  } finally {
    await f.close();
  }
});

test('FlowDesk lifecycle validates references and enforces the demo manager role on the server', async () => {
  const f = await fixture();
  try {
    const initial = await f.state();
    const created = await f.action('/api/flowdesk/tickets', {
      title: 'Настроить кассу',
      description: 'Тестовый терминал',
      clientId: initial.flowdesk.clients[0].id,
      status: 'new',
      priority: 'high',
      managerId: initial.flowdesk.managers[0].id,
      amount: 4500,
    });
    const ticket = created.flowdesk.tickets.at(-1);
    const moved = await f.action('/api/flowdesk/tickets/' + ticket.id + '/update', {
      status: 'progress',
    });
    assert.equal(moved.flowdesk.tickets.at(-1).status, 'progress');
    const commented = await f.action('/api/flowdesk/tickets/' + ticket.id + '/comments', {
      text: 'Назначен выезд',
    });
    assert.equal(commented.flowdesk.tickets.at(-1).comments.at(-1).text, 'Назначен выезд');
    await f.action('/api/session/role', { role: 'manager' });
    assert.equal(
      (await f.request('/api/flowdesk/tickets/' + ticket.id + '/delete', {})).response.status,
      403,
    );
    assert.equal(
      (
        await f.request('/api/orderly/products/' + initial.orderly.products[0].id + '/update', {
          price: 1,
        })
      ).response.status,
      403,
    );
    await f.action('/api/session/role', { role: 'admin' });
    const deleted = await f.action('/api/flowdesk/tickets/' + ticket.id + '/delete', {});
    assert.ok(!deleted.flowdesk.tickets.some((item) => item.id === ticket.id));
    assert.equal(
      (
        await f.request('/api/flowdesk/tickets', {
          title: 'Нет клиента',
          clientId: 'missing',
          managerId: 'missing',
          status: 'new',
          priority: 'normal',
          amount: 0,
          description: '',
        })
      ).response.status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('Orderly uses server catalog prices, persists order snapshots, deduplicates checkout and enforces transitions', async () => {
  const f = await fixture();
  try {
    const initial = await f.state();
    const product = initial.orderly.products[0];
    await f.action('/api/orderly/cart', { productId: product.id, quantity: 2 });
    const checkout = {
      name: 'Анна',
      phone: '+79990000001',
      note: 'Без сахара',
      idempotencyKey: 'checkout-key-00001',
    };
    const ordered = await f.action('/api/orderly/checkout', checkout);
    const order = ordered.orderly.orders.at(-1);
    assert.equal(order.total, product.price * 2);
    assert.equal(ordered.orderly.cart.length, 0);
    const duplicate = await f.action('/api/orderly/checkout', checkout);
    assert.equal(duplicate.orderly.orders.length, ordered.orderly.orders.length);
    assert.equal(
      (await f.request('/api/orderly/checkout', { ...checkout, name: 'Другая Анна' })).response
        .status,
      409,
    );
    assert.equal(
      (await f.request('/api/orderly/orders/' + order.id + '/status', { status: 'completed' }))
        .response.status,
      409,
    );
    await f.action('/api/orderly/orders/' + order.id + '/status', { status: 'preparing' });
    await f.action('/api/orderly/orders/' + order.id + '/status', { status: 'ready' });
    const completed = await f.action('/api/orderly/orders/' + order.id + '/status', {
      status: 'completed',
    });
    assert.equal(completed.orderly.orders.at(-1).status, 'completed');
    await f.action('/api/orderly/products/' + product.id + '/update', {
      price: product.price + 10,
    });
    assert.equal((await f.state()).orderly.orders.at(-1).total, product.price * 2);
    const newProduct = await f.action('/api/orderly/products', {
      name: 'Новый кофе',
      description: '250 мл',
      price: 350,
      category: 'coffee',
    });
    assert.equal(newProduct.orderly.products.at(-1).name, 'Новый кофе');
    await f.action('/api/orderly/products/' + product.id + '/update', { available: false });
    assert.equal(
      (await f.request('/api/orderly/cart', { productId: product.id, quantity: 1 })).response
        .status,
      409,
    );
  } finally {
    await f.close();
  }
});

test('PriceWatch worker records checks in SQLite without requests and creates threshold alerts', async () => {
  const f = await fixture({ intervalSeconds: 0.09, workerPollMs: 20 });
  try {
    const initial = await f.state();
    const added = await f.action('/api/pricewatch/watches', {
      productId: initial.pricewatch.catalog.at(-1).id,
      threshold: 1000000,
    });
    const watch = added.pricewatch.watches.at(-1);
    const count = watch.history.length;
    await new Promise((resolve) => setTimeout(resolve, 240));
    const db = new DatabaseSync(f.dbPath);
    const persisted = JSON.parse(db.prepare('SELECT data FROM workspaces').get().data);
    db.close();
    const changed = persisted.pricewatch.watches.find((item) => item.id === watch.id);
    assert.ok(changed.history.length > count, 'worker writes without any browser request');
    assert.equal(changed.history.at(-1).source, 'background');
    assert.ok(persisted.pricewatch.alerts.some((item) => item.watchId === watch.id));
    const manual = await f.action('/api/pricewatch/watches/' + watch.id + '/check', {});
    assert.equal(manual.pricewatch.watches.at(-1).history.at(-1).source, 'manual');
    assert.equal(
      (await f.request('/api/pricewatch/watches/' + watch.id + '/check', {})).response.status,
      429,
    );
    const read = await f.action('/api/pricewatch/alerts/read', {});
    assert.ok(read.pricewatch.alerts.every((item) => item.read));
    assert.equal(
      (
        await f.request('/api/pricewatch/watches', {
          productId: 'https://127.0.0.1/private',
          threshold: 1,
        })
      ).response.status,
      404,
    );
    await f.action('/api/pricewatch/watches/' + watch.id + '/delete', {});
    assert.ok(!(await f.state()).pricewatch.watches.some((item) => item.id === watch.id));
  } finally {
    await f.close();
  }
});

test('reset removes private changes and another visitor cannot address private identifiers', async () => {
  const f = await fixture();
  try {
    const initial = await f.state();
    const changed = await f.action('/api/flowdesk/clients', {
      name: 'Приватный клиент',
      company: '',
      email: '',
      phone: '',
    });
    const clientId = changed.flowdesk.clients.at(-1).id;
    await f.state('b');
    assert.equal(
      (await f.request('/api/flowdesk/clients/' + clientId + '/update', { name: 'Атака' }, 'b'))
        .response.status,
      404,
    );
    const reset = await f.action('/api/reset', {});
    assert.equal(reset.flowdesk.clients.length, initial.flowdesk.clients.length);
    assert.ok(!reset.flowdesk.clients.some((item) => item.id === clientId));
  } finally {
    await f.close();
  }
});

test('malformed inputs, CSRF, JSON errors and excess requests are rejected', async () => {
  const f = await fixture({ rateLimitMax: 12 });
  try {
    await f.state();
    assert.equal((await f.request('/api/session/role', { role: 'root' })).response.status, 400);
    assert.equal(
      (await f.request('/api/flowdesk/clients', { name: '', company: '', email: '', phone: '' }))
        .response.status,
      400,
    );
    assert.equal(
      (
        await f.request('/api/flowdesk/clients', {
          name: 'Клиент',
          company: '',
          email: 'bad',
          phone: '',
        })
      ).response.status,
      400,
    );
    assert.equal(
      (await f.request('/api/orderly/cart', { productId: 'coffee-flat', quantity: -1 })).response
        .status,
      400,
    );
    assert.equal(
      (await f.request('/api/reset', {}, 'a', { Origin: 'https://attacker.test' })).response.status,
      403,
    );
    assert.equal(
      (await f.request('/api/reset', {}, 'a', { 'X-Demo-Request': '' })).response.status,
      403,
    );
    const invalid = await fetch(f.origin + '/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Demo-Request': '1', Origin: f.origin },
      body: '{',
    });
    assert.equal(invalid.status, 400);
    let result;
    for (let i = 0; i < 15; i++) result = await f.request();
    assert.equal(result.response.status, 429);
    assert.ok(Number(result.response.headers.get('retry-after')) > 0);
  } finally {
    await f.close();
  }
});

test('workspace caps and absolute expiration bound persistence', async () => {
  const f = await fixture({ maxWorkspaces: 1, sessionTtlMs: 2000, workerPollMs: 20 });
  try {
    const first = await f.state();
    assert.equal((await f.request('/api/state', undefined, 'b')).response.status, 503);
    await f.action('/api/flowdesk/clients', {
      name: 'Исчезнет',
      company: '',
      email: '',
      phone: '',
    });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const renewed = await f.state();
    assert.equal(renewed.flowdesk.clients.length, first.flowdesk.clients.length);
    assert.notEqual(renewed.session.createdAt, first.session.createdAt);
  } finally {
    await f.close();
  }
});

test('Telegram validates signed initData and rejects stale or modified credentials', async () => {
  const token = '12345:synthetic-test-token';
  const f = await fixture({ telegramBotToken: token });
  try {
    await f.state();
    function signed(authDate) {
      const params = new URLSearchParams({
        auth_date: String(authDate),
        query_id: 'AA-test',
        user: JSON.stringify({ id: 42, first_name: 'Test' }),
      });
      const data = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => key + '=' + value)
        .join('\n');
      const secret = createHmac('sha256', 'WebAppData').update(token).digest();
      params.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
      return params.toString();
    }
    const valid = signed(Math.floor(Date.now() / 1000));
    const accepted = await f.action('/api/session/telegram', { initData: valid });
    assert.equal(accepted.session.mode, 'telegram');
    assert.equal(
      (await f.request('/api/session/telegram', { initData: valid.replace('AA-test', 'changed') }))
        .response.status,
      401,
    );
    assert.equal(
      (
        await f.request('/api/session/telegram', {
          initData: signed(Math.floor(Date.now() / 1000) - 1000),
        })
      ).response.status,
      401,
    );
  } finally {
    await f.close();
  }
});
