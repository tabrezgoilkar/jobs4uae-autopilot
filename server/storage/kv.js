import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

// Per-user JSON key-value storage, async so the same store code runs locally
// (filesystem) and in the cloud (Neon Postgres). Selected by any Postgres URL:
//   - DATABASE_URL / DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING set → Postgres
//   - none set → filesystem (local dev; 'local' user stays flat for back-compat)
//
//   await getJson(userId, key) -> parsed value | null
//   await setJson(userId, key, value) -> value

// Resolve a usable Postgres connection string from the vars Vercel/Neon expose.
// (DATABASE_URL is the canonical name; the project also sets POSTGRES_URL_NON_POOLING
// and DATABASE_URL_UNPOOLED, and we must not hard-fail if only those are present.)
function pgConnectionString() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    ''
  );
}

export function usingPostgres() {
  return !!pgConnectionString();
}
const safe = (s, fallback) => {
  const cleaned = String(s ?? '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
};

// --- Filesystem impl (local dev) ---
function userDir(userId) {
  const id = String(userId ?? '').trim();
  if (!id || id === 'local') return dataDir();
  return path.join(dataDir(), 'u', safe(id, 'local'));
}
function filePath(userId, key) {
  return path.join(userDir(userId), `${safe(key, 'data')}.json`);
}
async function fsGet(userId, key) {
  try {
    return JSON.parse(await fs.readFile(filePath(userId, key), 'utf8'));
  } catch {
    return null;
  }
}
async function fsSet(userId, key, value) {
  const p = filePath(userId, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2));
  return value;
}

// --- Postgres impl (cloud) — one jsonb row per (user, key) ---
let sqlClient;
let ensured;
async function sql() {
  if (!sqlClient) {
    const { neon } = await import('@neondatabase/serverless');
    sqlClient = neon(pgConnectionString());
  }
  return sqlClient;
}
async function ensureTable() {
  if (ensured) return ensured;
  ensured = (async () => {
    const db = await sql();
    await db`CREATE TABLE IF NOT EXISTS app_state (
      user_id text NOT NULL,
      key text NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key)
    )`;
  })();
  return ensured;
}
async function pgGet(userId, key) {
  await ensureTable();
  const db = await sql();
  const rows = await db`SELECT data FROM app_state WHERE user_id = ${String(userId ?? 'local')} AND key = ${String(key)}`;
  return rows[0]?.data ?? null;
}
async function pgSet(userId, key, value) {
  await ensureTable();
  const db = await sql();
  await db`INSERT INTO app_state (user_id, key, data, updated_at)
    VALUES (${String(userId ?? 'local')}, ${String(key)}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (user_id, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  return value;
}

export async function getJson(userId, key) {
  return usingPostgres() ? pgGet(userId, key) : fsGet(userId, key);
}
export async function setJson(userId, key, value) {
  return usingPostgres() ? pgSet(userId, key, value) : fsSet(userId, key, value);
}
