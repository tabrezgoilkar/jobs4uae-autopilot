import fs from 'node:fs';
import { configPath } from './paths.js';

export const DEFAULT_CONFIG = {
  engine: null, // 'gemini' | 'byok' | 'ollama'
  gemini: { apiKey: '', model: 'gemini-2.0-flash' },
  byok: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
  setupComplete: false,
};

export function loadConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...structuredClone(DEFAULT_CONFIG), ...raw };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}
