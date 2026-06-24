import { describe, it, expect, afterEach, vi } from 'vitest';
import { createEngine } from '../ai/index.js';

afterEach(() => vi.unstubAllGlobals());

describe('createEngine — openrouter (free auto-rotation)', () => {
  it('routes to OpenRouter and discovers a free model', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      calls.push(String(url));
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ data: [{ id: 'meta-llama/llama-3-8b-instruct:free', pricing: { prompt: '0', completion: '0' } }] }) };
      }
      // chat/completions
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) };
    }));

    const engine = createEngine({ engine: 'openrouter', openrouter: { apiKey: 'sk-or-test', model: 'auto' } });
    const res = await engine.testConnection();

    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/free model/i);
    // Hit OpenRouter, not OpenAI
    expect(calls.some((u) => u.includes('openrouter.ai/api/v1/models'))).toBe(true);
    expect(calls.some((u) => u.includes('openrouter.ai/api/v1/chat/completions'))).toBe(true);
    expect(calls.some((u) => u.includes('api.openai.com'))).toBe(false);
  });
});
