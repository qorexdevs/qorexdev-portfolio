import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeState } from './seed.mjs';
import { createStore } from './store.mjs';
import { registerActions } from './actions.mjs';

export function createApp(options = {}) {
  const dbPath = options.dbPath || process.env.DB_PATH || resolve('data/demo.sqlite');
  const intervalSeconds = options.intervalSeconds ?? 30;
  const workerPollMs = options.workerPollMs ?? 1000;
  const sessionTtlMs = options.sessionTtlMs ?? 86400000;
  const maxWorkspaces = options.maxWorkspaces ?? Number(process.env.MAX_WORKSPACES || 200);
  const maxWorkspaceBytes = options.maxWorkspaceBytes ?? 262144;
  const rateLimitMax = options.rateLimitMax ?? Number(process.env.RATE_LIMIT_MAX || 120);
  const newWorkspaceLimit =
    options.newWorkspaceLimit ?? Number(process.env.NEW_WORKSPACE_LIMIT || 20);
  const creationRates = new Map();
  const rateWindowMs = options.rateWindowMs ?? 60000;
  const telegramBotToken = options.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const telegramWebhookSecret =
    options.telegramWebhookSecret ?? process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  const publicOrigin = options.publicOrigin ?? process.env.PUBLIC_ORIGIN ?? '';
  const secureCookie = options.secureCookie ?? publicOrigin.startsWith('https://');
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === '1';
  if (
    !Number.isInteger(maxWorkspaces) ||
    maxWorkspaces < 1 ||
    !Number.isInteger(rateLimitMax) ||
    rateLimitMax < 1 ||
    !Number.isInteger(newWorkspaceLimit) ||
    newWorkspaceLimit < 1 ||
    !Number.isInteger(maxWorkspaceBytes) ||
    maxWorkspaceBytes < 1
  )
    throw new Error('Invalid server limits');
  if (
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds <= 0 ||
    !Number.isFinite(workerPollMs) ||
    workerPollMs <= 0 ||
    !Number.isFinite(sessionTtlMs) ||
    sessionTtlMs <= 0 ||
    !Number.isFinite(rateWindowMs) ||
    rateWindowMs <= 0
  )
    throw new Error('Invalid server timing');
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin)
    throw new Error('PUBLIC_ORIGIN must contain an origin without a trailing slash or path');
  if (
    telegramWebhookSecret &&
    (!telegramBotToken ||
      !publicOrigin.startsWith('https://') ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(telegramWebhookSecret))
  )
    throw new Error('Invalid Telegram webhook configuration');
  const store = createStore({
    dbPath,
    intervalSeconds,
    workerPollMs,
    telegramBotToken,
    maxWorkspaceBytes,
  });
  const { db, read, expire, insert, rates, publicState } = store;
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://telegram.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
          upgradeInsecureRequests: secureCookie ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      xFrameOptions: false,
      strictTransportSecurity: secureCookie ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.get('/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', worker: store.lastWorkerAt });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });
  app.post(
    '/telegram/webhook',
    (req, res, next) => {
      if (!telegramWebhookSecret) return res.sendStatus(404);
      const supplied = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
      const suppliedHash = createHash('sha256').update(supplied).digest();
      const expectedHash = createHash('sha256').update(telegramWebhookSecret).digest();
      if (!timingSafeEqual(suppliedHash, expectedHash)) return res.sendStatus(403);
      next();
    },
    express.json({ limit: '32kb', strict: true }),
    (req, res) => {
      const message = req.body?.message;
      if (
        !Number.isSafeInteger(req.body?.update_id) ||
        message?.chat?.type !== 'private' ||
        !Number.isSafeInteger(message.chat.id) ||
        typeof message.text !== 'string'
      )
        return res.sendStatus(200);
      res.json({
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: 'Orderly - демонстрационный проект qorexdev. Соберите корзину и оформите тестовый заказ. Оплаты и доставки здесь нет.',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть Orderly', web_app: { url: `${publicOrigin}/demo/orderly` } }],
          ],
        },
      });
    },
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let bucket = rates.get(ip);
    if (!bucket || bucket.until <= now) {
      if (rates.size >= 5000 && !bucket)
        return res
          .status(503)
          .json({ error: 'Сервис занят. Попробуйте через минуту.', code: 'BUSY' });
      bucket = { count: 0, until: now + rateWindowMs };
      rates.set(ip, bucket);
    }
    bucket.count++;
    if (bucket.count > rateLimitMax) {
      const retryAfter = Math.ceil((bucket.until - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Слишком много запросов. Подождите немного.',
        code: 'RATE_LIMIT',
        retryAfter,
      });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const allowedOrigin = publicOrigin || req.protocol + '://' + req.get('host');
      if (
        req.get('X-Demo-Request') !== '1' ||
        req.get('Sec-Fetch-Site') === 'cross-site' ||
        (req.get('origin') && req.get('origin') !== allowedOrigin)
      ) {
        return res
          .status(403)
          .json({ error: 'Запрос не прошел проверку источника.', code: 'CSRF' });
      }
      if (!req.is('application/json'))
        return res.status(415).json({ error: 'Ожидается JSON.', code: 'JSON_REQUIRED' });
    }
    next();
  });
  app.use('/api', express.json({ limit: '32kb', strict: true }), cookieParser());
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    const token = req.cookies.qorex_demo;
    let key =
      typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
        ? createHash('sha256').update(token).digest('hex')
        : null;
    let row = key ? read.get(key, now) : null;
    if (!row) {
      if (req.method !== 'GET' || req.path !== '/state')
        return res.status(req.method === 'GET' ? 404 : 401).json({
          error: 'Сначала откройте демоверсию и загрузите данные.',
          code: 'SESSION_REQUIRED',
        });
      for (const [ip, bucket] of creationRates) if (bucket.until <= now) creationRates.delete(ip);
      const ip = req.ip || 'unknown';
      const creation = creationRates.get(ip) || { count: 0, until: now + 3600000 };
      if (creation.count >= newWorkspaceLimit) {
        const retryAfter = Math.ceil((creation.until - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Лимит новых демосессий с этого адреса. Используйте уже открытую вкладку.',
          code: 'WORKSPACE_RATE',
          retryAfter,
        });
      }
      if (!creationRates.has(ip) && creationRates.size >= 5000)
        return res.status(503).json({ error: 'Сервис занят. Попробуйте позже.', code: 'BUSY' });
      expire.run(now);
      if (db.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count >= maxWorkspaces)
        return res
          .status(503)
          .json({ error: 'Все демопространства заняты. Попробуйте позже.', code: 'WORKSPACE_CAP' });
      const secret = randomBytes(32).toString('hex');
      key = createHash('sha256').update(secret).digest('hex');
      const state = makeState(now, intervalSeconds, now + sessionTtlMs, !!telegramBotToken);
      insert.run(key, now, now + sessionTtlMs, store.serialize(state));
      store.saveState(state, key);
      creation.count++;
      creationRates.set(ip, creation);
      row = read.get(key, now);
      res.cookie('qorex_demo', secret, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
        maxAge: sessionTtlMs,
        path: '/',
      });
    }
    req.workspaceId = key;
    req.workspaceRow = row;
    next();
  });
  app.get('/api/state', (req, res) => res.json(publicState(JSON.parse(req.workspaceRow.data))));
  registerActions(app, store, { intervalSeconds, telegramBotToken });
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'Метод API не найден.', code: 'NOT_FOUND' }),
  );
  const dist = options.distPath || resolve('dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(
      express.static(dist, {
        maxAge: '1h',
        setHeaders(res, file) {
          if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    const status =
      error.type === 'entity.too.large'
        ? 413
        : error.type === 'entity.parse.failed'
          ? 400
          : error.status || 500;
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    if (status === 500) console.error('Request failed:', error.message);
    res.status(status).json({
      error:
        status === 500
          ? 'Внутренняя ошибка. Попробуйте позже.'
          : status === 413
            ? 'Слишком большой запрос.'
            : status === 400 && error.type
              ? 'Некорректный JSON.'
              : error.message,
      code:
        error.code ||
        (status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'VALIDATION' : 'INTERNAL'),
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    });
  });
  return { app, db, close: store.close };
}
