const path = '/telegram/webhook';
const secretHeader = 'X-Telegram-Bot-Api-Secret-Token';
const maxBodyBytes = 32 * 1024;
const appUrl = 'https://qorex.dev/demo/orderly';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== path)
      return new Response('Not found', { status: 404 });
    if (!env.TELEGRAM_WEBHOOK_SECRET)
      return new Response('Webhook is unavailable', { status: 503 });
    if (request.headers.get(secretHeader) !== env.TELEGRAM_WEBHOOK_SECRET)
      return new Response('Forbidden', { status: 403 });
    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      return new Response('Expected JSON', { status: 415 });
    if (Number(request.headers.get('Content-Length')) > maxBodyBytes)
      return new Response('Request too large', { status: 413 });

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes)
      return new Response('Request too large', { status: 413 });
    let update;
    try {
      update = JSON.parse(raw);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const message = update?.message;
    if (
      !Number.isSafeInteger(update?.update_id) ||
      message?.chat?.type !== 'private' ||
      !Number.isSafeInteger(message.chat.id) ||
      typeof message.text !== 'string'
    )
      return new Response('OK');

    return Response.json({
      method: 'sendMessage',
      chat_id: message.chat.id,
      text: 'Orderly - демонстрационный проект qorexdev. Соберите корзину и оформите тестовый заказ. Оплаты и доставки здесь нет.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть Orderly', web_app: { url: appUrl } }]],
      },
    });
  },
};
