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

describe('application-details API', () => {
  it('GET returns empty details initially', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/application-details');
    expect(res.status).toBe(200);
    expect(res.body.fields.nationality).toBe('');
    expect(res.body.memory).toEqual([]);
  });

  it('POST merges a fields patch and GET reflects it', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app)
      .post('/api/application-details')
      .send({ fields: { nationality: 'Indian', expectedSalary: '18000' } });
    expect(res.status).toBe(200);
    expect(res.body.fields.nationality).toBe('Indian');

    const after = await request(app).get('/api/application-details');
    expect(after.body.fields.expectedSalary).toBe('18000');
  });
});
