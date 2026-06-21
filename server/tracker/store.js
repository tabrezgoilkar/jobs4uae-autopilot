import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

export const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];

function storePath() {
  return path.join(dataDir(), 'applications.json');
}

export function listApplications() {
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
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addApplication(app) {
  // Strip any client-supplied id/createdAt/updatedAt; server always stamps these.
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = app ?? {};
  const now = new Date().toISOString();
  const status = STATUSES.includes(rest.status) ? rest.status : 'saved';
  const record = { ...rest, status, id: newId(), createdAt: now, updatedAt: now };
  const list = listApplications();
  list.unshift(record); // newest first
  writeAll(list);
  return record;
}

export function getApplication(id) {
  return listApplications().find((a) => a.id === id) ?? null;
}

export function updateApplication(id, patch) {
  const list = listApplications();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  // Strip id and createdAt from patch; they must not be overwritten.
  const { id: _i, createdAt: _c, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}

export function deleteApplication(id) {
  const list = listApplications();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  writeAll(list);
  return true;
}
