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
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('config API', () => {
  it('GET /api/config returns defaults', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.setupComplete).toBe(false);
  });

  it('POST /api/config saves and is reflected on GET', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/config').send({ engine: 'gemini', setupComplete: true });
    const res = await request(app).get('/api/config');
    expect(res.body.engine).toBe('gemini');
    expect(res.body.setupComplete).toBe(true);
  });
});
