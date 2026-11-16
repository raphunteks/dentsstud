import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
interface Config {
  apiBase: string;
  installationId: string;
}

const dir = () => {
  const d = app.getPath('userData');
  mkdirSync(d, { recursive: true });
  return d;
};

/** Baked at build time (DENTWEB_API_BASE); users can change it on the "Server API" screen. */
declare const __DENTWEB_BAKED_API__: string;
export const DEFAULT_API_BASE = process.env.DENTWEB_API_BASE || (typeof __DENTWEB_BAKED_API__ === 'string' && __DENTWEB_BAKED_API__) || 'http://localhost:4000';

export function loadConfig(): Config {
  const p = join(dir(), 'config.json');
  let cfg: Partial<Config> = {};
  if (existsSync(p)) {
    try {
      cfg = JSON.parse(readFileSync(p, 'utf8')) as Partial<Config>;
    } catch {
      cfg = {};
    }
  }
  const full: Config = { apiBase: cfg.apiBase ?? DEFAULT_API_BASE, installationId: cfg.installationId ?? `${randomUUID()}${randomUUID()}`.replaceAll('-', '') };
  if (!cfg.installationId || !cfg.apiBase) writeFileSync(p, JSON.stringify(full, null, 2), { mode: 0o600 });
  return full;
}

export function saveConfig(patch: Partial<Config>) {
  const next = { ...loadConfig(), ...patch };
  writeFileSync(join(dir(), 'config.json'), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

/** Tokens are persisted only through the OS keychain-backed safeStorage. Otherwise memory-only. */
let memoryTokens: Tokens | null = null;
export const secureStorageAvailable = () => safeStorage.isEncryptionAvailable();

export function readTokens(): Tokens | null {
  if (memoryTokens) return memoryTokens;
  const p = join(dir(), 'session.bin');
  if (!existsSync(p) || !secureStorageAvailable()) return null;
  try {
    memoryTokens = JSON.parse(safeStorage.decryptString(readFileSync(p))) as Tokens;
    return memoryTokens;
  } catch {
    return null;
  }
}

export function writeTokens(t: Tokens | null) {
  memoryTokens = t;
  const p = join(dir(), 'session.bin');
  if (!t) {
    rmSync(p, { force: true });
    return;
  }
  if (secureStorageAvailable()) writeFileSync(p, safeStorage.encryptString(JSON.stringify(t)), { mode: 0o600 });
}

/** Local SQLite (node:sqlite, no native addon): offline cache, activation proof, operation journal. */
let db: DatabaseSync | null = null;
export function localDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(join(dir(), 'dentweb.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS operation_journal (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
      payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS operation_journal_project ON operation_journal(project_id, status);
  `);
  return db;
}

export const kvGet = (key: string): string | null => {
  const row = localDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
};
export const kvSet = (key: string, value: string) =>
  localDb().prepare("INSERT INTO kv(key, value, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(key, value);
export const kvDel = (key: string) => localDb().prepare('DELETE FROM kv WHERE key = ?').run(key);
