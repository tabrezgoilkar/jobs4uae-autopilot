import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { getJson, setJson, usingPostgres } from '../storage/kv.js';

// Job-tracker (saved/applied/interview/offer/rejected). Persists through the
// storage adapter: Postgres when DATABASE_URL is set (cloud, per-user, durable
// across cold starts), else a JSON file under dataDir() (desktop / fallback).
export const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const KEY = 'applications';

function newId() {
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Postgres-backed (cloud) ---
async function pgList(userId) {
  const arr = await getJson(userId, KEY);
  return Array.isArray(arr) ? arr : [];
}
async function pgWrite(userId, list) {
  await setJson(userId, KEY, list);
  return list;
}

// --- File-backed (local dev / fallback) ---
function fileStorePath(userId) {
  const id = String(userId ?? 'local').trim();
  const base = id && id !== 'local' ? path.join(dataDir(), 'u', id) : dataDir();
  return path.join(base, 'applications.json');
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
function fileWrite(userId, list) {
  const p = fileStorePath(userId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2));
  return list;
}

// --- Public async API ---
export async function listApplications(userId) {
  return usingPostgres() ? pgList(userId) : fileList(userId);
}

export async function addApplication(userId, app) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = app ?? {};
  const now = new Date().toISOString();
  const status = STATUSES.includes(rest.status) ? rest.status : 'saved';
  const record = { ...rest, status, id: newId(), createdAt: now, updatedAt: now };
  const list = await listApplications(userId);
  list.unshift(record); // newest first
  await writeAll(userId, list);
  return record;
}

export async function getApplication(userId, id) {
  const list = await listApplications(userId);
  return list.find((a) => a.id === id) ?? null;
}

export async function updateApplication(userId, id, patch) {
  const list = await listApplications(userId);
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  // Strip id and createdAt from patch; they must not be overwritten.
  const { id: _i, createdAt: _c, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  await writeAll(userId, list);
  return list[idx];
}

export async function deleteApplication(userId, id) {
  const list = await listApplications(userId);
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await writeAll(userId, list);
  return true;
}

async function writeAll(userId, list) {
  return usingPostgres() ? pgWrite(userId, list) : fileWrite(userId, list);
}
