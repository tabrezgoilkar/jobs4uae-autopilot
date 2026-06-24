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

const VOYAGER = {
  profile: { firstName: 'Jane', lastName: 'Doe', headline: 'Senior Engineer', locationName: 'Dubai' },
  positionView: { elements: [{ title: 'Senior Engineer', companyName: 'Acme', timePeriod: { startDate: { month: 3, year: 2021 } } }] },
  skillView: { elements: [{ name: 'Node.js' }] },
};

describe('LinkedIn import API', () => {
  it('POST /api/profile/linkedin/import merges a JSON body and returns { merged, changes } without saving', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    // pre-seed an edited profile to prove merge (not overwrite)
    await request(app).post('/api/profile').send({ fullName: 'Jane A. Doe' });

    const res = await request(app).post('/api/profile/linkedin/import').send(VOYAGER);
    expect(res.status).toBe(200);
    expect(res.body.merged.fullName).toBe('Jane A. Doe'); // user edit preserved
    expect(res.body.merged.headline).toBe('Senior Engineer'); // blank filled
    expect(res.body.changes.added.experience).toBe(1);
    expect(res.body.changes.added.skills).toBe(1);

    // import must NOT have persisted anything
    const after = await request(app).get('/api/profile');
    expect(after.body.headline).toBe('');
  });

  it('accepts a JSON Resume file upload via multipart', async () => {
    const { createApp } = await import('../app.js');
    const jsonResume = JSON.stringify({ basics: { name: 'John Roe', label: 'Data Eng' }, work: [], skills: [{ name: 'Python' }] });
    const res = await request(createApp())
      .post('/api/profile/linkedin/import')
      .attach('file', Buffer.from(jsonResume), 'linkedin-profile.json');
    expect(res.status).toBe(200);
    expect(res.body.merged.fullName).toBe('John Roe');
    expect(res.body.changes.added.skills).toBe(1);
  });

  it('returns 422 for JSON that is not a recognizable LinkedIn export', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/import').send({ hello: 'world' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeTruthy();
  });

  it('answers the CORS preflight from linkedin.com', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .options('/api/profile/linkedin/import')
      .set('Origin', 'https://www.linkedin.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://www.linkedin.com');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('echoes the CORS allow-origin on the actual POST', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/linkedin/import')
      .set('Origin', 'https://www.linkedin.com')
      .send(VOYAGER);
    expect(res.headers['access-control-allow-origin']).toBe('https://www.linkedin.com');
  });

  it('stashes a bookmarklet (linkedin.com origin) import so the app can pick it up once', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile/linkedin/import').set('Origin', 'https://www.linkedin.com').send(VOYAGER);

    const first = await request(app).get('/api/profile/linkedin/pending');
    expect(first.status).toBe(200);
    expect(first.body.pending.merged.headline).toBe('Senior Engineer');
    expect(first.body.pending.changes.added.experience).toBe(1);

    // take-once: a second poll is empty
    const second = await request(app).get('/api/profile/linkedin/pending');
    expect(second.body.pending).toBe(null);
  });

  it('does NOT stash a same-origin file upload (app uses the response directly)', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const jsonResume = JSON.stringify({ basics: { name: 'John Roe' }, work: [] });
    await request(app).post('/api/profile/linkedin/import').attach('file', Buffer.from(jsonResume), 'p.json');
    const res = await request(app).get('/api/profile/linkedin/pending');
    expect(res.body.pending).toBe(null);
  });
});
