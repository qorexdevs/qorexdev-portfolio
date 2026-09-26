import test from 'node:test';
import assert from 'node:assert/strict';

const secret = 'synthetic-webhook-secret-123456';
const endpoint = 'https://relay.example/telegram/webhook';

function request(body, supplied = secret) {
  return new Request(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': supplied,
    },
    body: JSON.stringify(body),
  });
}

test('edge webhook rejects requests without the Telegram secret', async () => {
  const worker = (await import('../relay/worker.mjs')).default;
  const response = await worker.fetch(request({ update_id: 1 }, 'wrong'), {
    TELEGRAM_WEBHOOK_SECRET: secret,
  });
  assert.equal(response.status, 403);
});

test('edge webhook replies to a private message with the Orderly Mini App', async () => {
  const worker = (await import('../relay/worker.mjs')).default;
  const response = await worker.fetch(
    request({ update_id: 2, message: { text: '/start', chat: { id: 42, type: 'private' } } }),
    { TELEGRAM_WEBHOOK_SECRET: secret },
  );
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.method, 'sendMessage');
  assert.equal(reply.chat_id, 42);
  assert.match(reply.text, /демонстрацион/);
  assert.equal(
    reply.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://qorex.dev/demo/orderly',
  );
});

test('edge webhook ignores non-private updates and caps request bodies', async () => {
  const worker = (await import('../relay/worker.mjs')).default;
  const env = { TELEGRAM_WEBHOOK_SECRET: secret };
  const ignored = await worker.fetch(
    request({ update_id: 3, message: { text: '/start', chat: { id: -42, type: 'group' } } }),
    env,
  );
  assert.equal(ignored.status, 200);
  assert.equal(await ignored.text(), 'OK');
  const oversized = await worker.fetch(request({ payload: 'x'.repeat(32769) }), env);
  assert.equal(oversized.status, 413);
});
