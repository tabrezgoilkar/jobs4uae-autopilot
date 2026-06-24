import { getJson, setJson } from '../storage/kv.js';

// Per-user tailored-document store (resume + cover letter markdown), keyed via the
// storage adapter so it works locally (files) and in the cloud (Postgres).

function listAll(userId) {
  const arr = getJson(userId, 'documents');
  return Array.isArray(arr) ? arr : [];
}

export function listDocuments(userId) {
  return listAll(userId);
}

function writeAll(userId, list) {
  setJson(userId, 'documents', list);
}

function newId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addDocument(userId, doc) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = doc ?? {};
  const now = new Date().toISOString();
  const record = { ...rest, id: newId(), createdAt: now, updatedAt: now };
  const list = listAll(userId);
  list.unshift(record);
  writeAll(userId, list);
  return record;
}

export function getDocument(userId, id) {
  return listAll(userId).find((d) => d.id === id) ?? null;
}

export function updateDocument(userId, id, patch) {
  const list = listAll(userId);
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  writeAll(userId, list);
  return list[idx];
}
