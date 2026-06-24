import { getJson, setJson } from '../storage/kv.js';

// Per-user tailored-document store (resume + cover letter markdown), via the
// async storage adapter so it works locally (files) and in the cloud (Postgres).

async function listAll(userId) {
  const arr = await getJson(userId, 'documents');
  return Array.isArray(arr) ? arr : [];
}

export async function listDocuments(userId) {
  return listAll(userId);
}

function newId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addDocument(userId, doc) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = doc ?? {};
  const now = new Date().toISOString();
  const record = { ...rest, id: newId(), createdAt: now, updatedAt: now };
  const list = await listAll(userId);
  list.unshift(record);
  await setJson(userId, 'documents', list);
  return record;
}

export async function getDocument(userId, id) {
  return (await listAll(userId)).find((d) => d.id === id) ?? null;
}

export async function updateDocument(userId, id, patch) {
  const list = await listAll(userId);
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  await setJson(userId, 'documents', list);
  return list[idx];
}
