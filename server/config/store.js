import { getJson, setJson } from '../storage/kv.js';

// Per-user app config (AI engine + keys + setupComplete), via the async storage
// adapter. Each user has their own config row (cloud) / file (local 'local' user
// stays flat for back-compat). Setup is therefore per-account.
export const DEFAULT_CONFIG = {
  engine: null, // 'gemini' | 'byok' | 'ollama'
  gemini: { apiKey: '', model: 'gemini-2.0-flash' },
  byok: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
  setupComplete: false,
};

function normalize(raw) {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...raw,
    gemini: { ...DEFAULT_CONFIG.gemini, ...raw?.gemini },
    byok: { ...DEFAULT_CONFIG.byok, ...raw?.byok },
    ollama: { ...DEFAULT_CONFIG.ollama, ...raw?.ollama },
  };
}

export async function loadConfig(userId) {
  const raw = await getJson(userId, 'config');
  return raw ? normalize(raw) : structuredClone(DEFAULT_CONFIG);
}

export async function saveConfig(userId, partial) {
  const base = await loadConfig(userId);
  const next = {
    ...base,
    ...partial,
    gemini: { ...base.gemini, ...partial?.gemini },
    byok: { ...base.byok, ...partial?.byok },
    ollama: { ...base.ollama, ...partial?.ollama },
  };
  return setJson(userId, 'config', next);
}
