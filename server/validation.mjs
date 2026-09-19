import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { productImages } from './seed.mjs';

export function fail(status, code, message, retryAfter) {
  throw Object.assign(new Error(message), { status, code, retryAfter });
}
export const text = (max, min = 0) => z.string().trim().min(min).max(max);
export const id = text(100, 1);
export const empty = z.object({}).strict();
export const clientSchema = z
  .object({
    name: text(80, 2),
    company: text(100).default(''),
    email: z.union([z.literal(''), z.email().max(150)]).default(''),
    phone: text(30).default(''),
  })
  .strict();
export const ticketSchema = z
  .object({
    title: text(140, 3),
    description: text(2000).default(''),
    clientId: id,
    status: z.enum(['new', 'progress', 'waiting', 'done']).default('new'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    managerId: id,
    amount: z.number().int().min(0).max(10000000).default(0),
  })
  .strict();
export const productSchema = z
  .object({
    name: text(80, 2),
    description: text(300).default(''),
    category: z.enum(['coffee', 'dessert', 'beans']),
    price: z.number().int().min(1).max(100000),
    image: z.enum(productImages).optional(),
    available: z.boolean().default(true),
  })
  .strict();
export const thresholdSchema = z
  .object({ threshold: z.number().int().min(1).max(10000000) })
  .strict();
export const checkoutSchema = z
  .object({
    name: text(80, 2),
    phone: text(30, 7).regex(/^[+0-9 ()-]+$/),
    note: text(300).default(''),
    idempotencyKey: text(100, 12).regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict();
export const find = (items, value) =>
  items.find((item) => item.id === value) ||
  fail(404, 'NOT_FOUND', 'Запись не найдена в вашей демоверсии.');
export const bounded = (items, max) => {
  if (items.length >= max)
    fail(409, 'LIMIT_REACHED', 'Достигнут лимит демоверсии. Удалите запись или сбросьте данные.');
};
export const admin = (state) => {
  if (state.session.role !== 'admin')
    fail(403, 'ADMIN_REQUIRED', 'Для этого действия выберите роль администратора.');
};
export const stamp = (time) => new Date(time).toISOString();

export function validateTelegram(initData, token, now = Date.now()) {
  if (!token)
    fail(
      503,
      'TELEGRAM_NOT_CONFIGURED',
      'Telegram не подключен. Используйте браузерный деморежим.',
    );
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    fail(401, 'TELEGRAM_INVALID', 'Данные Telegram недействительны.');
  const hash = params.get('hash') || '';
  const authDate = Number(params.get('auth_date'));
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !Number.isInteger(authDate) ||
    authDate * 1000 > now + 30000 ||
    now - authDate * 1000 > 300000
  ) {
    fail(
      401,
      'TELEGRAM_INVALID',
      'Данные Telegram устарели или недействительны. Откройте приложение снова.',
    );
  }
  const data = entries
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => key + '=' + value)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const signature = createHmac('sha256', secret).update(data).digest();
  if (!timingSafeEqual(signature, Buffer.from(hash, 'hex')))
    fail(401, 'TELEGRAM_INVALID', 'Подпись Telegram не прошла проверку.');
  let user;
  try {
    user = JSON.parse(params.get('user') || '{}');
  } catch {
    fail(401, 'TELEGRAM_INVALID', 'Данные пользователя Telegram недействительны.');
  }
  if (!Number.isSafeInteger(user.id) || user.id <= 0)
    fail(401, 'TELEGRAM_INVALID', 'Данные пользователя Telegram недействительны.');
  return user.id;
}
