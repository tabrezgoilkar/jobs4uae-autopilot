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

  it('raw fetch-job link is cloud-safe (no 501) — generic fetch extracts text', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    // On the cloud, a non-LinkedIn URL no longer 501s; it goes through the
    // server-side fetch + HTML→text extraction. example.com has no job text,
    // so it returns a graceful 422 (not a 501 "needs desktop browser").
    const res = await request(createCloudApp()).post('/api/scanner/fetch-job').send({ url: 'https://example.com/job' });
    expect(res.status).not.toBe(501);
  });

  it('exposes the cloud-safe email-compose route', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    // 422 (no recruiter email) proves the route exists and ran, without needing AI.
    const res = await request(createCloudApp()).post('/api/apply/email/compose').send({ jobText: 'no email here' });
    expect(res.status).toBe(422);
  });

  it('mounts the resume/cover-letter PDF route (cloud-safe, no browser)', async () => {
    const { createCloudApp } = await import('../cloudApp.js');
    // A mounted handler returns our JSON 404 ("Document not found"), NOT a missing
    // route. This guards against the regression where pdfRouter wasn't mounted on
    // the cloud app (documents page 404'd on the hosted deploy).
    const res = await request(createCloudApp()).post('/api/documents/does-not-exist/pdf?kind=resume');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/document not found/i);
  });

  it('persists evaluations on serverless without crashing (no DATABASE_URL, VERCEL env)', async () => {
    // Reproduces the ENOENT "/var/task/data" bug: on Vercel, DATABASE_URL is
    // often unset, so storage falls back to the filesystem. The cwd (/var/task)
    // is read-only; dataDir() must pick a writable dir (/tmp) instead.
    vi.stubEnv('JOBS4UAE_DATA_DIR', '');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('VERCEL', '1');
    const { createCloudApp } = await import('../cloudApp.js');
    const app = createCloudApp();
    const res = await request(app)
      .post('/api/evaluate')
      .send({ jobText: 'Senior Accountant at ACME Dubai. 5 years experience required.', userId: 'local' });
    // 200 (scored+persisted) or a clean 4xx — but NOT a 500 ENOENT.
    expect(res.status).toBeLessThan(500);
    vi.unstubAllEnvs();
  });
});
