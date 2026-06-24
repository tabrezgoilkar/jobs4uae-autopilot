import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

// Per-user JSON key-value storage. The store layer talks to this interface so the
// same code runs locally (filesystem) and, in the cloud, against Postgres (a
// drop-in impl added at deploy time). Whole-collection get/set mirrors the
// original file-store semantics.
//
//   getJson(userId, key) -> parsed value | null
//   setJson(userId, key, value) -> value

const safe = (s, fallback) => {
  const cleaned = String(s ?? '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
};

function userDir(userId) {
  const id = String(userId ?? '').trim();
  // 'local' (the dev-bypass single user) stays flat for backward compatibility;
  // real users are namespaced under data/u/<userId>/.
  if (!id || id === 'local') return dataDir();
  return path.join(dataDir(), 'u', safe(id, 'local'));
}

function filePath(userId, key) {
  return path.join(userDir(userId), `${safe(key, 'data')}.json`);
}

export function getJson(userId, key) {
  const p = filePath(userId, key);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function setJson(userId, key, value) {
  const p = filePath(userId, key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2));
  return value;
}
