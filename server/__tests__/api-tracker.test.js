import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-api-tracker-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('tracker API', () => {
  it('full CRUD happy path', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();

    // Create
    const created = await request(app).post('/api/applications').send({
      jobTitle: 'Software Engineer',
      company: 'TechCorp',
      location: 'Dubai, UAE',
      notes: 'Referral from John',
    });
    expect(created.status).toBe(200);
    expect(created.body.id).toMatch(/^app_/);
    expect(created.body.jobTitle).toBe('Software Engineer');
    expect(created.body.status).toBe('saved');

    const { id } = created.body;

    // List
    const list = await request(app).get('/api/applications');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(id);

    // Get by id
    const got = await request(app).get(`/api/applications/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.company).toBe('TechCorp');

    // Update status
    const updated = await request(app).post(`/api/applications/${id}`).send({ status: 'interview' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('interview');

    // Delete
    const deleted = await request(app).post(`/api/applications/${id}/delete`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.ok).toBe(true);

    // Confirm gone
    const afterDelete = await request(app).get('/api/applications');
    expect(afterDelete.body).toHaveLength(0);
  });

  it('POST /api/applications returns 400 for invalid status', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/applications')
      .send({ jobTitle: 'Dev', company: 'X', status: 'accepted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('POST /api/applications/:id returns 400 for invalid status on update', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const created = await request(app).post('/api/applications').send({ jobTitle: 'Dev', company: 'Y' });
    const res = await request(app).post(`/api/applications/${created.body.id}`).send({ status: 'ghosted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid status/i);
  });

  it('GET /api/applications/:id returns 404 for missing id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/applications/no-such-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /api/applications/:id returns 404 for missing id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/applications/no-such-id').send({ notes: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /api/applications/:id/delete returns 404 for missing id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/applications/no-such-id/delete');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
