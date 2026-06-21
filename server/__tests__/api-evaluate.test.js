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

function writeConfig() {
  fs.writeFileSync(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }),
  );
}
function stubGemini(jsonText) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }),
  })));
}

describe('evaluate API', () => {
  it('POST /api/evaluate returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/evaluate').send({ jobText: 'Accountant' });
    expect(res.status).toBe(409);
  });

  it('POST /api/evaluate returns 400 when jobText is missing', async () => {
    writeConfig();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/evaluate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/evaluate evaluates, saves, and returns the graded result', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).post('/api/evaluate').send({ jobText: 'Accountant role in Dubai' });
    expect(res.status).toBe(200);
    expect(res.body.grade).toBe('B');
    expect(res.body.id).toBeTruthy();
    const list = await request(app).get('/api/evaluations');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(res.body.id);
  });

  it('GET /api/evaluations/:id returns 404 for an unknown id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/evaluations/nope');
    expect(res.status).toBe(404);
  });

  it('GET /api/evaluations/:id returns the saved evaluation', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const created = await request(app).post('/api/evaluate').send({ jobText: 'Accountant role in Dubai' });
    const res = await request(app).get(`/api/evaluations/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });
});
