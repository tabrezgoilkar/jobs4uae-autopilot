import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

function storePath() {
  return path.join(dataDir(), 'documents.json');
}

export function listDocuments() {
  const p = storePath();
  if (!fs.existsSync(p)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2));
}

function newId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addDocument(doc) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = doc ?? {};
  const now = new Date().toISOString();
  const record = { ...rest, id: newId(), createdAt: now, updatedAt: now };
  const list = listDocuments();
  list.unshift(record);
  writeAll(list);
  return record;
}

export function getDocument(id) {
  return listDocuments().find((d) => d.id === id) ?? null;
}

export function updateDocument(id, patch) {
  const list = listDocuments();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}
