import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;

beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('config store', () => {
  it('returns defaults when no config file exists', async () => {
    const { loadConfig } = await import('../config/store.js');
    const cfg = await loadConfig('local');
    expect(cfg.engine).toBe(null);
    expect(cfg.setupComplete).toBe(false);
    expect(cfg.gemini.model).toBe('gemini-2.0-flash');
  });

  it('persists saved config to disk', async () => {
    const { saveConfig, loadConfig } = await import('../config/store.js');
    await saveConfig('local', { engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true });
    const cfg = await loadConfig('local');
    expect(cfg.engine).toBe('gemini');
    expect(cfg.gemini.apiKey).toBe('k');
    expect(cfg.setupComplete).toBe(true);
  });

  it('keeps nested defaults when a saved file omits sub-fields', async () => {
    const { loadConfig } = await import('../config/store.js');
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ gemini: { apiKey: 'only-key' } }));
    const cfg = await loadConfig('local');
    expect(cfg.gemini.apiKey).toBe('only-key');
    expect(cfg.gemini.model).toBe('gemini-2.0-flash');
  });
});
