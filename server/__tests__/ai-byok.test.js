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
});
