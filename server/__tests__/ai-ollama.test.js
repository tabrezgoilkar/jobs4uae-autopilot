import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOllamaEngine } from '../ai/ollama.js';

afterEach(() => vi.unstubAllGlobals());

describe('ollama engine', () => {
  it('reports not-ok when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the model is installed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:latest' }] }),
    })));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });

  it('reports not-ok when running but model is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'mistral:latest' }] }),
    })));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });
});
