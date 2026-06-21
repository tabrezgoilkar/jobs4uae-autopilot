import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
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
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('profile API', () => {
  it('GET /api/profile returns an empty profile', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('');
  });

  it('POST /api/profile saves and GET reflects it', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Jane Doe' });
    const res = await request(app).get('/api/profile');
    expect(res.body.fullName).toBe('Jane Doe');
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('POST /api/profile/import parses an uploaded text CV via the AI engine', async () => {
    // Config: use gemini so createEngine builds the Gemini engine; stub fetch.
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }),
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"fullName":"Jane Doe","skills":["Node"]}' }] } }],
      }),
    })));
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/import')
      .attach('cv', Buffer.from('Jane Doe — Node developer'), 'resume.txt');
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Jane Doe');
    expect(res.body.skills).toEqual(['Node']);
  });

  it('POST /api/profile/import returns 400 when no file is attached', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/import');
    expect(res.status).toBe(400);
  });

  it('POST /api/profile/import returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/import')
      .attach('cv', Buffer.from('some text'), 'resume.txt');
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });
});
