import { setTimeout as sleep } from 'node:timers/promises';
import { telegramReply } from './telegram-reply.mjs';

export function createTelegramBot({ db, publicOrigin, request, logger = console }) {
  if (!publicOrigin.startsWith('https://')) throw new Error('Bot requires HTTPS public origin');
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_bot_cursor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_offset INTEGER NOT NULL
    )
  `);
  const readOffset = db.prepare('SELECT next_offset FROM telegram_bot_cursor WHERE id = 1');
  const saveOffset = db.prepare(`
    INSERT INTO telegram_bot_cursor (id, next_offset) VALUES (1, ?)
    ON CONFLICT (id) DO UPDATE SET next_offset = excluded.next_offset
  `);
  let offset = readOffset.get()?.next_offset ?? 0;
  const controller = new AbortController();
  let loop;

  async function pollOnce(signal = controller.signal) {
    const updates = await request(
      'getUpdates',
      { offset, timeout: 20, limit: 20, allowed_updates: ['message'] },
      signal,
    );
    if (!Array.isArray(updates)) throw new Error('Invalid Telegram updates');
    let processed = 0;
    for (const update of updates) {
      if (!Number.isSafeInteger(update?.update_id) || update.update_id < offset) continue;
      const message = update.message;
      if (
        message?.chat?.type === 'private' &&
        Number.isSafeInteger(message.chat.id) &&
        typeof message.text === 'string'
      ) {
        try {
          await request('sendMessage', telegramReply(message.chat.id, publicOrigin), signal);
        } catch (error) {
          if (error?.code !== 'BOT_API_403') throw error;
          logger.info('Telegram bot skipped a blocked chat');
        }
      }
      offset = update.update_id + 1;
      saveOffset.run(offset);
      processed++;
    }
    return processed;
  }

  function start() {
    if (loop) return;
    loop = (async () => {
      let retryMs = 1000;
      let connected = false;
      while (!controller.signal.aborted) {
        try {
          const processed = await pollOnce();
          if (!connected) {
            logger.info('Telegram bot polling connected');
            connected = true;
          }
          if (processed) logger.info(`Telegram bot processed ${processed} updates`);
          retryMs = 1000;
        } catch (error) {
          if (controller.signal.aborted) break;
          connected = false;
          logger.error('Telegram bot polling failed:', error?.code || error?.name || 'unknown');
          try {
            await sleep(retryMs, undefined, { signal: controller.signal });
          } catch {
            break;
          }
          retryMs = Math.min(retryMs * 2, 60000);
        }
      }
    })();
  }

  async function stop() {
    controller.abort();
    await loop;
  }

  return { pollOnce, start, stop };
}
