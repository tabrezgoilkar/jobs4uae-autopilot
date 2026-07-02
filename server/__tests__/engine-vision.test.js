import { describe, it, expect, vi, afterEach } from 'vitest';
import { createByoKeyEngine } from '../ai/byok.js';
import { createGeminiEngine } from '../ai/gemini.js';

afterEach(() => vi.restoreAllMocks());

const IMAGES = [{ base64: 'AAA', mimeType: 'image/png' }];

describe('byok generateVision', () => {
  it('sends an OpenAI image_url message and returns the model text', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"fullName":"X"}' } }] }), text: async () => '' };
    });
    const engine = createByoKeyEngine({ baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'gpt-4o-mini' });
    const out = await engine.generateVision({ system: 'S', prompt: 'P', images: IMAGES });
    expect(out).toBe('{"fullName":"X"}');
    const body = JSON.parse(calls.at(-1).opts.body);
    const user = body.messages.find((m) => m.role === 'user');
    expect(user.content.find((c) => c.type === 'image_url').image_url.url).toBe('data:image/png;base64,AAA');
    expect(user.content.find((c) => c.type === 'text').text).toContain('P');
  });
});

describe('gemini generateVision', () => {
  it('sends inline_data image parts and returns the model text', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"fullName":"Y"}' }] } }] }), text: async () => '' };
    });
    const engine = createGeminiEngine({ apiKey: 'k', model: 'gemini-2.0-flash' });
    const out = await engine.generateVision({ system: 'S', prompt: 'P', images: IMAGES });
    expect(out).toBe('{"fullName":"Y"}');
    const body = JSON.parse(calls.at(-1).opts.body);
    const parts = body.contents[0].parts;
    expect(parts.find((p) => p.text)?.text).toContain('P');
    const inline = (parts.find((p) => p.inline_data || p.inlineData) || {});
    const d = inline.inline_data || inline.inlineData;
    expect(d.mime_type || d.mimeType).toBe('image/png');
    expect(d.data).toBe('AAA');
  });
});
