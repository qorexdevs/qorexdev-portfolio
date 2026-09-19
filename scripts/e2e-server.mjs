import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

const directory = await mkdtemp(join(tmpdir(), 'qorexdev-e2e-'));
const runtime = createApp({
  dbPath: join(directory, 'demo.sqlite'),
  rateLimitMax: 10000,
  newWorkspaceLimit: 1000,
  maxWorkspaces: 1000,
});
const server = runtime.app.listen(3101, '127.0.0.1', () =>
  console.log('Isolated E2E server ready on 3101'),
);
async function close() {
  server.close(async () => {
    runtime.close();
    await rm(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.once('SIGTERM', close);
process.once('SIGINT', close);
