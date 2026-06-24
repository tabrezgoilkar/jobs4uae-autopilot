import { EMPTY_PROFILE, normalizeProfile } from './schema.js';
import { getJson, setJson } from '../storage/kv.js';

export function loadProfile(userId) {
  const raw = getJson(userId, 'profile');
  return raw ? normalizeProfile(raw) : structuredClone(EMPTY_PROFILE);
}

export function saveProfile(userId, profile) {
  const next = { ...normalizeProfile(profile), updatedAt: new Date().toISOString() };
  return setJson(userId, 'profile', next);
}
