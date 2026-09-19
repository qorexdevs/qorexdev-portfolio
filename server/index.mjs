import { createApp } from './app.mjs';

const runtime = createApp();
const port = Number(process.env.PORT || 3000);
const server = runtime.app.listen(port, '0.0.0.0', () =>
  console.log('qorexdev listening on port ' + port),
);
function shutdown() {
  server.close(() => {
    runtime.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
