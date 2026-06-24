import { EMPTY_PROFILE, normalizeProfile } from './schema.js';
import { getJson, setJson } from '../storage/kv.js';

export async function loadProfile(userId) {
  const raw = await getJson(userId, 'profile');
  return raw ? normalizeProfile(raw) : structuredClone(EMPTY_PROFILE);
}

export async function saveProfile(userId, profile) {
  const next = { ...normalizeProfile(profile), updatedAt: new Date().toISOString() };
  return setJson(userId, 'profile', next);
}
