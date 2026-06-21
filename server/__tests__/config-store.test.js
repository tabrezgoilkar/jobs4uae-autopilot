import { describe, it, expect, beforeEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmp;
});

describe('config store', () => {
  it('returns defaults when no config file exists', async () => {
    const { loadConfig } = await import('../config/store.js');
    const cfg = loadConfig();
    expect(cfg.engine).toBe(null);
    expect(cfg.setupComplete).toBe(false);
    expect(cfg.gemini.model).toBe('gemini-2.0-flash');
  });

  it('persists saved config to disk', async () => {
    const { saveConfig, loadConfig } = await import('../config/store.js');
    saveConfig({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true });
    const cfg = loadConfig();
    expect(cfg.engine).toBe('gemini');
    expect(cfg.gemini.apiKey).toBe('k');
    expect(cfg.setupComplete).toBe(true);
  });
});
