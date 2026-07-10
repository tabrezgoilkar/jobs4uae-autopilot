import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-cloud-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('cloud app', () => {
  it('boots and serves health', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    const res = await request(createCloudApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('serves the per-user profile route (dev bypass → local)', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    const app = createCloudApp();
    await request(app).post('/api/profile').send({ fullName: 'Cloud User' });
    const res = await request(app).get('/api/profile');
    expect(res.body.fullName).toBe('Cloud User');
  });

  it('does NOT mount the browser-only routes (those are companion/local-only)', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    const res = await request(createCloudApp()).get('/api/connections');
    expect(res.status).toBe(404);
  });

  it('mounts the cloud-safe scanner (rest boards only, no browser)', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    const res = await request(createCloudApp()).get('/api/scanner/boards');
    expect(res.status).toBe(200);
    const ids = res.body.map((b) => b.id);
    expect(ids).toContain('linkedin');
    expect(ids).toContain('freehire');
    // indeed requires a headed browser and must NOT be exposed on cloud.
    expect(ids).not.toContain('indeed');
  });

  it('raw fetch-job link is 501 on cloud (needs the desktop browser)', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    const res = await request(createCloudApp()).post('/api/scanner/fetch-job').send({ url: 'https://example.com/job' });
    expect(res.status).toBe(501);
  });

  it('exposes the cloud-safe email-compose route', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    // 422 (no recruiter email) proves the route exists and ran, without needing AI.
    const res = await request(createCloudApp()).post('/api/apply/email/compose').send({ jobText: 'no email here' });
    expect(res.status).toBe(422);
  });
});
