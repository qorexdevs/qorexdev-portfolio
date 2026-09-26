import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

test('Telegram polling replies to private messages and persists the next update offset', async () => {
  const { createTelegramBot } = await import('../server/bot.mjs');
  const db = new DatabaseSync(':memory:');
  try {
    const calls = [];
    const bot = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      request: async (method, body) => {
        calls.push({ method, body });
        if (method === 'getUpdates')
          return [
            { update_id: 10, message: { text: '/start', chat: { id: 42, type: 'private' } } },
            { update_id: 11, message: { text: '/start', chat: { id: -1, type: 'group' } } },
          ];
        return true;
      },
    });
    await bot.pollOnce();
    assert.equal(calls[0].method, 'getUpdates');
    assert.equal(calls[0].body.offset, 0);
    assert.equal(calls[1].method, 'sendMessage');
    assert.equal(calls[1].body.chat_id, 42);
    assert.equal(
      calls[1].body.reply_markup.inline_keyboard[0][0].web_app.url,
      'https://qorex.dev/demo/orderly',
    );
    assert.equal(calls.length, 2);

    let resumedOffset;
    const resumed = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      request: async (_method, body) => {
        resumedOffset = body.offset;
        return [];
      },
    });
    await resumed.pollOnce();
    assert.equal(resumedOffset, 12);
  } finally {
    db.close();
  }
});

test('Telegram polling does not acknowledge an update when sending its reply fails', async () => {
  const { createTelegramBot } = await import('../server/bot.mjs');
  const db = new DatabaseSync(':memory:');
  try {
    const bot = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      request: async (method) => {
        if (method === 'getUpdates')
          return [
            { update_id: 30, message: { text: 'Привет', chat: { id: 42, type: 'private' } } },
          ];
        throw new Error('network failure');
      },
    });
    await assert.rejects(bot.pollOnce(), /network failure/);
    let offset;
    const retry = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      request: async (_method, body) => {
        offset = body.offset;
        return [];
      },
    });
    await retry.pollOnce();
    assert.equal(offset, 0);
  } finally {
    db.close();
  }
});

test('Telegram polling skips a blocked chat so later updates can continue', async () => {
  const { createTelegramBot } = await import('../server/bot.mjs');
  const db = new DatabaseSync(':memory:');
  try {
    const bot = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      logger: { info() {}, error() {} },
      request: async (method) => {
        if (method === 'getUpdates')
          return [
            { update_id: 40, message: { text: '/start', chat: { id: 42, type: 'private' } } },
          ];
        throw Object.assign(new Error('blocked'), { code: 'BOT_API_403' });
      },
    });
    await bot.pollOnce();
    let offset;
    const resumed = createTelegramBot({
      db,
      publicOrigin: 'https://qorex.dev',
      request: async (_method, body) => {
        offset = body.offset;
        return [];
      },
    });
    await resumed.pollOnce();
    assert.equal(offset, 41);
  } finally {
    db.close();
  }
});
