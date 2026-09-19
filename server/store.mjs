import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { catalog, catalogAt, priceAt } from './seed.mjs';
import { fail, find, stamp } from './validation.mjs';

export function createStore({
  dbPath,
  intervalSeconds,
  workerPollMs,
  telegramBotToken,
  maxWorkspaceBytes,
}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  if (db.prepare('PRAGMA user_version').get().user_version > 1)
    throw new Error('Unsupported database schema version');
  db.exec(
    'PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA auto_vacuum = INCREMENTAL; CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, data TEXT NOT NULL, next_check_at INTEGER NOT NULL DEFAULT 0) STRICT; CREATE INDEX IF NOT EXISTS workspace_expiry ON workspaces(expires_at);',
  );
  if (
    !db
      .prepare('PRAGMA table_info(workspaces)')
      .all()
      .some((column) => column.name === 'next_check_at')
  )
    db.exec('ALTER TABLE workspaces ADD COLUMN next_check_at INTEGER NOT NULL DEFAULT 0');
  db.exec(
    'CREATE INDEX IF NOT EXISTS workspace_due ON workspaces(next_check_at); PRAGMA user_version = 1;',
  );
  const read = db.prepare('SELECT * FROM workspaces WHERE id = ? AND expires_at > ?');
  const update = db.prepare('UPDATE workspaces SET data = ?, next_check_at = ? WHERE id = ?');
  const expire = db.prepare('DELETE FROM workspaces WHERE expires_at <= ?');
  const insert = db.prepare(
    'INSERT INTO workspaces (id, created_at, expires_at, data) VALUES (?, ?, ?, ?)',
  );
  const rates = new Map();
  let closed = false;
  let lastWorkerAt = null;

  function serialize(state) {
    const body = JSON.stringify(state);
    const business = {
      ...state,
      pricewatch: {
        ...state.pricewatch,
        alerts: [],
        watches: state.pricewatch.watches.map((watch) => ({ ...watch, history: [] })),
      },
    };
    if (
      Buffer.byteLength(body) > maxWorkspaceBytes ||
      Buffer.byteLength(JSON.stringify(business)) > maxWorkspaceBytes / 2
    ) {
      fail(
        409,
        'WORKSPACE_SIZE',
        'Демопространство заполнено. Удалите лишние заявки или сбросьте данные.',
      );
    }
    return body;
  }
  function saveState(state, key) {
    const next = state.pricewatch.watches.length
      ? Math.min(...state.pricewatch.watches.map((watch) => Date.parse(watch.nextCheckAt)))
      : Date.parse(state.session.expiresAt);
    update.run(serialize(state), next, key);
  }

  function publicState(state) {
    const { schemaVersion: _version, _private: _hidden, ...result } = state;
    result.pricewatch = {
      ...result.pricewatch,
      catalog: catalogAt(Date.now()),
      intervalSeconds,
      lastWorkerAt,
    };
    result.session = { ...result.session, telegramConfigured: !!telegramBotToken };
    return result;
  }
  function recordCheck(state, watch, now, source) {
    const product = find(catalog, watch.productId);
    const price = priceAt(product, now);
    const previous = watch.history.at(-1)?.price;
    watch.history.push({ checkedAt: stamp(now), price, source });
    watch.history = watch.history.slice(-120);
    watch.lastCheckedAt = stamp(now);
    watch.nextCheckAt = stamp(now + intervalSeconds * 1000);
    if (
      price <= watch.threshold &&
      (previous === undefined ||
        previous > watch.threshold ||
        !state.pricewatch.alerts.some((alert) => alert.watchId === watch.id))
    ) {
      state.pricewatch.alerts.unshift({
        id: randomUUID(),
        watchId: watch.id,
        productName: product.name,
        price,
        threshold: watch.threshold,
        createdAt: stamp(now),
        read: false,
      });
      state.pricewatch.alerts = state.pricewatch.alerts.slice(0, 100);
    }
  }
  function runWorker() {
    if (closed) return;
    const now = Date.now();
    lastWorkerAt = stamp(now);
    db.exec('BEGIN IMMEDIATE');
    try {
      expire.run(now);
      for (const row of db
        .prepare(
          'SELECT id, data FROM workspaces WHERE next_check_at <= ? ORDER BY next_check_at LIMIT 50',
        )
        .iterate(now)) {
        const state = JSON.parse(row.data);
        let changed = false;
        for (const watch of state.pricewatch.watches) {
          if (Date.parse(watch.nextCheckAt) <= now) {
            recordCheck(state, watch, now, 'background');
            changed = true;
          }
        }
        if (changed) {
          state.pricewatch.lastWorkerAt = stamp(now);
          saveState(state, row.id);
        } else {
          saveState(state, row.id);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    for (const [key, bucket] of rates) if (bucket.until <= now) rates.delete(key);
  }
  runWorker();
  const worker = setInterval(() => {
    try {
      runWorker();
    } catch (error) {
      console.error('Background price check failed:', error.message);
    }
  }, workerPollMs);
  worker.unref();
  return {
    db,
    read,
    saveState,
    serialize,
    expire,
    insert,
    rates,
    publicState,
    recordCheck,
    get lastWorkerAt() {
      return lastWorkerAt;
    },
    close() {
      if (!closed) {
        closed = true;
        clearInterval(worker);
        db.close();
      }
    },
  };
}
