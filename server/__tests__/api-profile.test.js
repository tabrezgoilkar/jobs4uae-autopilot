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

  it('GET /api/profile/pdf returns a real PDF attachment', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Jane Doe', email: 'j@x.com' });
    const res = await request(app).get('/api/profile/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.slice(0, 8).toString('latin1')).toBe('%PDF-1.4');
  });

  it('GET /api/profile/docx returns a real Word attachment', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Jane Doe' });
    const res = await request(app)
      .get('/api/profile/docx')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('officedocument.wordprocessingml');
    expect(res.headers['content-disposition']).toContain('.docx');
    // EOCD signature of a valid zip
    const buf = Buffer.from(res.body);
    expect(buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBeGreaterThan(0);
  });
});
