import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { catalog, makeState } from './seed.mjs';
import {
  admin,
  bounded,
  checkoutSchema,
  clientSchema,
  empty,
  fail,
  find,
  id,
  productSchema,
  stamp,
  text,
  thresholdSchema,
  ticketSchema,
  validateTelegram,
} from './validation.mjs';

export function registerActions(app, store, { intervalSeconds, telegramBotToken }) {
  const { db, read, saveState, publicState, recordCheck } = store;
  const applyPatch = (record, data, submitted) => {
    for (const key of Object.keys(submitted)) record[key] = data[key];
  };
  function action(path, schema, mutate) {
    app.post(path, (req, res, next) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: 'Проверьте обязательные поля, формат и допустимые значения.',
          code: 'VALIDATION',
        });
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = read.get(req.workspaceId, Date.now());
        if (!row) fail(409, 'SESSION_EXPIRED', 'Демосессия завершена. Обновите страницу.');
        let state = JSON.parse(row.data);
        const replaced = mutate(state, parsed.data, req, row);
        if (replaced) state = replaced;
        saveState(state, req.workspaceId);
        db.exec('COMMIT');
        res.json(publicState(state));
      } catch (error) {
        db.exec('ROLLBACK');
        next(error);
      }
    });
  }
  action('/api/reset', empty, (_state, _data, _req, row) =>
    makeState(Date.now(), intervalSeconds, row.expires_at, !!telegramBotToken),
  );
  action(
    '/api/session/role',
    z.object({ role: z.enum(['admin', 'manager']) }).strict(),
    (state, data) => {
      state.session.role = data.role;
    },
  );
  action(
    '/api/session/telegram',
    z.object({ initData: text(12000, 1) }).strict(),
    (state, data) => {
      state._private.telegramUserId = validateTelegram(data.initData, telegramBotToken);
      state.session.mode = 'telegram';
    },
  );
  action('/api/flowdesk/clients', clientSchema, (state, data) => {
    bounded(state.flowdesk.clients, 100);
    state.flowdesk.clients.push({ id: randomUUID(), ...data });
  });
  action('/api/flowdesk/clients/:id/update', clientSchema.partial(), (state, data, req) => {
    applyPatch(find(state.flowdesk.clients, req.params.id), data, req.body);
  });
  action('/api/flowdesk/tickets', ticketSchema, (state, data) => {
    bounded(state.flowdesk.tickets, 150);
    find(state.flowdesk.clients, data.clientId);
    find(state.flowdesk.managers, data.managerId);
    state.flowdesk.tickets.push({
      id: randomUUID(),
      number: Math.max(1040, ...state.flowdesk.tickets.map((ticket) => ticket.number)) + 1,
      ...data,
      comments: [],
      createdAt: stamp(Date.now()),
    });
  });
  action(
    '/api/flowdesk/tickets/:id/update',
    ticketSchema.omit({ clientId: true }).partial(),
    (state, data, req) => {
      if (data.managerId) find(state.flowdesk.managers, data.managerId);
      applyPatch(find(state.flowdesk.tickets, req.params.id), data, req.body);
    },
  );
  action(
    '/api/flowdesk/tickets/:id/comments',
    z.object({ text: text(1000, 1) }).strict(),
    (state, data, req) => {
      const ticket = find(state.flowdesk.tickets, req.params.id);
      bounded(ticket.comments, 40);
      ticket.comments.push({
        id: randomUUID(),
        text: data.text,
        author: state.session.role === 'admin' ? 'Администратор' : 'Менеджер',
        createdAt: stamp(Date.now()),
      });
    },
  );
  action('/api/flowdesk/tickets/:id/delete', empty, (state, _data, req) => {
    admin(state);
    find(state.flowdesk.tickets, req.params.id);
    state.flowdesk.tickets = state.flowdesk.tickets.filter((ticket) => ticket.id !== req.params.id);
  });
  action(
    '/api/orderly/cart',
    z.object({ productId: id, quantity: z.number().int().min(0).max(20) }).strict(),
    (state, data) => {
      const product = find(state.orderly.products, data.productId);
      if (data.quantity && !product.available)
        fail(409, 'UNAVAILABLE', 'Этот товар временно недоступен.');
      const cart = state.orderly.cart.filter((item) => item.productId !== data.productId);
      if (data.quantity) {
        bounded(cart, 20);
        cart.push({ productId: product.id, quantity: data.quantity });
      }
      state.orderly.cart = cart;
    },
  );
  action('/api/orderly/checkout', checkoutSchema, (state, data) => {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ name: data.name, phone: data.phone, note: data.note }))
      .digest('hex');
    const previous = Object.hasOwn(state._private.checkouts, data.idempotencyKey)
      ? state._private.checkouts[data.idempotencyKey]
      : undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        fail(409, 'IDEMPOTENCY_CONFLICT', 'Этот идентификатор уже использован для другого заказа.');
      return;
    }
    if (!state.orderly.cart.length) fail(409, 'EMPTY_CART', 'Добавьте товары в корзину.');
    bounded(state.orderly.orders, 100);
    const items = state.orderly.cart.map((item) => {
      const product = find(state.orderly.products, item.productId);
      if (!product.available)
        fail(
          409,
          'UNAVAILABLE',
          'Товар "' + product.name + '" больше недоступен. Удалите его из корзины.',
        );
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      };
    });
    const order = {
      id: randomUUID(),
      number: Math.max(1200, ...state.orderly.orders.map((item) => item.number)) + 1,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      name: data.name,
      phone: data.phone,
      note: data.note,
      status: 'new',
      createdAt: stamp(Date.now()),
    };
    state.orderly.orders.push(order);
    state.orderly.cart = [];
    state._private.checkouts[data.idempotencyKey] = { fingerprint, orderId: order.id };
  });
  action('/api/orderly/products', productSchema, (state, data) => {
    admin(state);
    bounded(state.orderly.products, 40);
    state.orderly.products.push({
      id: randomUUID(),
      ...data,
      image:
        data.image || { coffee: 'flat-white', dessert: 'croissant', beans: 'beans' }[data.category],
    });
  });
  action(
    '/api/orderly/products/:id/update',
    productSchema.omit({ category: true, image: true }).partial(),
    (state, data, req) => {
      admin(state);
      applyPatch(find(state.orderly.products, req.params.id), data, req.body);
    },
  );
  const transitions = {
    new: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  action(
    '/api/orderly/orders/:id/status',
    z.object({ status: z.enum(['new', 'preparing', 'ready', 'completed', 'cancelled']) }).strict(),
    (state, data, req) => {
      admin(state);
      const order = find(state.orderly.orders, req.params.id);
      if (order.status !== data.status && !transitions[order.status].includes(data.status))
        fail(
          409,
          'INVALID_TRANSITION',
          'Заказ нельзя перевести в этот статус. Следуйте этапам приготовления.',
        );
      order.status = data.status;
    },
  );
  action('/api/pricewatch/watches', thresholdSchema.extend({ productId: id }), (state, data) => {
    bounded(state.pricewatch.watches, 6);
    find(catalog, data.productId);
    if (state.pricewatch.watches.some((watch) => watch.productId === data.productId))
      fail(409, 'ALREADY_WATCHED', 'Этот товар уже отслеживается.');
    const now = Date.now();
    const watch = {
      id: randomUUID(),
      productId: data.productId,
      threshold: data.threshold,
      createdAt: stamp(now),
      lastCheckedAt: stamp(now),
      nextCheckAt: stamp(now + intervalSeconds * 1000),
      history: [],
    };
    recordCheck(state, watch, now, 'manual');
    state.pricewatch.watches.push(watch);
  });
  action('/api/pricewatch/watches/:id/threshold', thresholdSchema, (state, data, req) => {
    find(state.pricewatch.watches, req.params.id).threshold = data.threshold;
  });
  action('/api/pricewatch/watches/:id/check', empty, (state, _data, req) => {
    const watch = find(state.pricewatch.watches, req.params.id);
    const now = Date.now();
    const last = state._private.manualChecks[watch.id] || 0;
    if (now - last < 10000)
      fail(
        429,
        'CHECK_COOLDOWN',
        'Повторная ручная проверка доступна через 10 секунд.',
        Math.ceil((10000 - now + last) / 1000),
      );
    state._private.manualChecks[watch.id] = now;
    recordCheck(state, watch, now, 'manual');
  });
  action('/api/pricewatch/watches/:id/delete', empty, (state, _data, req) => {
    find(state.pricewatch.watches, req.params.id);
    state.pricewatch.watches = state.pricewatch.watches.filter(
      (watch) => watch.id !== req.params.id,
    );
    state.pricewatch.alerts = state.pricewatch.alerts.filter(
      (alert) => alert.watchId !== req.params.id,
    );
    delete state._private.manualChecks[req.params.id];
  });
  action('/api/pricewatch/alerts/read', empty, (state) => {
    state.pricewatch.alerts.forEach((alert) => {
      alert.read = true;
    });
  });
}
