import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGeminiEngine } from '../ai/gemini.js';

afterEach(() => vi.unstubAllGlobals());

describe('gemini engine', () => {
  it('reports not-ok when no API key is set', async () => {
    const engine = createGeminiEngine({ apiKey: '' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the API responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
    })));
    const engine = createGeminiEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });

  it('reports not-ok on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'bad key' })));
    const engine = createGeminiEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });
});
