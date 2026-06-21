import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { EMPTY_PROFILE, normalizeProfile } from './schema.js';

function profilePath() {
  return path.join(dataDir(), 'profile.json');
}

export function loadProfile() {
  const p = profilePath();
  if (!fs.existsSync(p)) return { ...EMPTY_PROFILE };
  try {
    return normalizeProfile(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(profile) {
  const next = { ...normalizeProfile(profile), updatedAt: new Date().toISOString() };
  const p = profilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2));
  return next;
}
