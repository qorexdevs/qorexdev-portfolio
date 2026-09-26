import { createApp } from './app.mjs';
import { createTelegramBot } from './bot.mjs';
import { createTelegramTransport } from './bot-transport.mjs';

const runtime = createApp();
const bot =
  process.env.TELEGRAM_BOT_POLLING === '1'
    ? createTelegramBot({
        db: runtime.db,
        publicOrigin: process.env.PUBLIC_ORIGIN || '',
        request: createTelegramTransport(process.env.TELEGRAM_BOT_TOKEN, process.env.BOT_PROXY_URL),
      })
    : null;
bot?.start();
const port = Number(process.env.PORT || 3000);
const server = runtime.app.listen(port, '0.0.0.0', () =>
  console.log('qorexdev listening on port ' + port),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const botStopped = bot?.stop();
  server.close(async () => {
    await botStopped;
    runtime.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
