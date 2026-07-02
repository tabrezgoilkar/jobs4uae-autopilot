import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('POST /api/profile/baseline', () => {
  it('renders a baseline from the posted profile (no AI needed when setup is incomplete)', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/baseline')
      .send({ profile: { fullName: 'Jane Doe', headline: 'Engineer', experience: [{ company: 'Acme', title: 'Eng' }] } });
    expect(res.status).toBe(200);
    expect(res.body.baselineMarkdown).toContain('# Jane Doe');
    expect(res.body.baselineMarkdown).toContain('Acme');
    expect(res.body.summaryGenerated).toBe(false); // no engine → no fabricated summary
  });

  it('falls back to the saved profile when none is posted', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Saved User', headline: 'PM' });
    const res = await request(app).post('/api/profile/baseline').send({});
    expect(res.status).toBe(200);
    expect(res.body.baselineMarkdown).toContain('# Saved User');
  });
});
