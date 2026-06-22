import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Each test re-imports the module so the per-baseUrl "last good model" cache is fresh.
let createByoKeyEngine;
beforeEach(async () => {
  vi.resetModules();
  ({ createByoKeyEngine } = await import('../ai/byok.js'));
});
afterEach(() => vi.unstubAllGlobals());

const OPENROUTER = 'https://openrouter.ai/api/v1';

function stubOpenRouter({ free = [], chat }) {
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    if (String(url).endsWith('/models')) {
      return { ok: true, json: async () => ({ data: free.map((id) => ({ id, pricing: { prompt: '0', completion: '0' } })) }) };
    }
    const model = JSON.parse(opts.body).model;
    return chat(model);
  }));
}

describe('byok auto free-model fallback (OpenRouter)', () => {
  it('auto-discovers a free model when model is "auto"', async () => {
    stubOpenRouter({
      free: ['vendor/a:free', 'vendor/b:free'],
      chat: () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }] }) }),
    });
    const engine = createByoKeyEngine({ baseUrl: OPENROUTER, apiKey: 'k', model: 'auto' });
    const out = await engine.generate({ prompt: 'hi' });
    expect(out).toBe('hello');
  });

  it('rotates to the next free model when the configured one is retired (404)', async () => {
    stubOpenRouter({
      free: ['vendor/good:free'],
      chat: (m) =>
        m === 'dead/model:free'
          ? { ok: false, status: 404, text: async () => 'model unavailable for free' }
          : { ok: true, json: async () => ({ choices: [{ message: { content: 'recovered' } }] }) },
    });
    const engine = createByoKeyEngine({ baseUrl: OPENROUTER, apiKey: 'k', model: 'dead/model:free' });
    const out = await engine.generate({ prompt: 'hi' });
    expect(out).toBe('recovered');
  });

  it('does NOT rotate on a non-model error (e.g. 401 auth)', async () => {
    stubOpenRouter({
      free: ['vendor/a:free'],
      chat: () => ({ ok: false, status: 401, text: async () => 'invalid key' }),
    });
    const engine = createByoKeyEngine({ baseUrl: OPENROUTER, apiKey: 'bad', model: 'auto' });
    await expect(engine.generate({ prompt: 'hi' })).rejects.toThrow(/401/);
  });

  it('testConnection reports the free model it landed on', async () => {
    stubOpenRouter({
      free: ['vendor/a:free'],
      chat: () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) }),
    });
    const engine = createByoKeyEngine({ baseUrl: OPENROUTER, apiKey: 'k', model: 'auto' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/vendor\/a:free/);
  });

  it('non-OpenRouter providers never call the models endpoint', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const engine = createByoKeyEngine({ baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'gpt-4o-mini' });
    await engine.generate({ prompt: 'hi' });
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/models'))).toBe(false);
  });
});
