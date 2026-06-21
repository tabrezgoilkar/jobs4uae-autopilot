import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

afterEach(() => vi.unstubAllGlobals());

describe('AI test API', () => {
  it('POST /api/ai/test returns ok for a working engine', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
    })));
    const res = await request(createApp())
      .post('/api/ai/test')
      .send({ engine: 'gemini', gemini: { apiKey: 'x' } });
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/ai/test returns 400 for an unknown engine', async () => {
    const res = await request(createApp()).post('/api/ai/test').send({ engine: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
