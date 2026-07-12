import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { getJson, setJson, usingPostgres } from '../storage/kv.js';

// Evaluation history. Persists through the storage adapter:
//   - DATABASE_URL set   → Postgres (cloud, per-user, durable across cold starts)
//   - DATABASE_URL unset → JSON file under dataDir() (desktop / fallback)
//
// Public API takes a userId so cloud evaluations are scoped per account.

const KEY = 'evaluations';

function newId() {
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Postgres-backed (cloud) ---
async function pgList(userId) {
  const arr = await getJson(userId, KEY);
  return Array.isArray(arr) ? arr : [];
}
async function pgAdd(userId, evaluation) {
  const { id: _ignoredId, createdAt: _ignoredTs, ...rest } = evaluation ?? {};
  const record = { ...rest, id: newId(), createdAt: new Date().toISOString() };
  const list = await pgList(userId);
  list.unshift(record);
  await setJson(userId, KEY, list);
  return record;
}

// --- File-backed (local dev / fallback) ---
function fileStorePath(userId) {
  // 'local' stays flat for back-compat; real users get a namespaced subdir.
  const id = String(userId ?? 'local').trim();
  const base = id && id !== 'local' ? path.join(dataDir(), 'u', id) : dataDir();
  return path.join(base, 'evaluations.json');
}
function fileList(userId) {
  const p = fileStorePath(userId);
  if (!fs.existsSync(p)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function fileAdd(userId, evaluation) {
  const { id: _ignoredId, createdAt: _ignoredTs, ...rest } = evaluation ?? {};
  const record = { ...rest, id: newId(), createdAt: new Date().toISOString() };
  const list = fileList(userId);
  list.unshift(record);
  const p = fileStorePath(userId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2));
  return record;
}

// --- Public async API ---
export async function listEvaluations(userId) {
  return usingPostgres() ? pgList(userId) : fileList(userId);
}

export async function addEvaluation(userId, evaluation) {
  return usingPostgres() ? pgAdd(userId, evaluation) : fileAdd(userId, evaluation);
}

export async function getEvaluation(userId, id) {
  const list = await listEvaluations(userId);
  return list.find((e) => e.id === id) ?? null;
}
