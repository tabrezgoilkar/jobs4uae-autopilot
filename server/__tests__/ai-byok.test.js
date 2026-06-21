import { describe, it, expect, vi, afterEach } from 'vitest';
import { createByoKeyEngine } from '../ai/byok.js';

afterEach(() => vi.unstubAllGlobals());

describe('byok engine', () => {
  it('reports not-ok without a key', async () => {
    const engine = createByoKeyEngine({ apiKey: '' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the API responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
    })));
    const engine = createByoKeyEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });

  it('reports not-ok on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401, text: async () => 'invalid api key',
    })));
    const engine = createByoKeyEngine({ apiKey: 'bad' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/401/);
  });
});
