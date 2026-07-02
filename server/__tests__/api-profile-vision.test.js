import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const extractProfileFromImages = vi.fn();
vi.mock('../profile/vision.js', () => ({ extractProfileFromImages }));

const normalized = (over = {}) => ({
  fullName: '', email: '', phone: '', location: '', headline: '', summary: '',
  skills: [], experience: [], education: [], projects: [], certifications: [], languages: [], awards: [], links: [],
  ...over,
});

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  extractProfileFromImages.mockReset();
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

async function withSetup(app) {
  await request(app).post('/api/config').send({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true });
}

describe('POST /api/profile/linkedin/vision', () => {
  it('returns 400 when no images are attached', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await withSetup(app);
    const res = await request(app).post('/api/profile/linkedin/vision');
    expect(res.status).toBe(400);
  });

  it('returns 409 until the AI setup wizard is complete', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/linkedin/vision')
      .attach('images', Buffer.from('img'), 'p.png');
    expect(res.status).toBe(409);
  });

  it('extracts from the images and returns { merged, changes } without saving', async () => {
    extractProfileFromImages.mockResolvedValue(normalized({ headline: 'Engineer', skills: ['Go'] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    await withSetup(app);

    const res = await request(app)
      .post('/api/profile/linkedin/vision')
      .attach('images', Buffer.from('imgbytes'), 'a.png');
    expect(res.status).toBe(200);
    expect(res.body.merged.headline).toBe('Engineer');
    expect(res.body.changes.added.skills).toBe(1);

    // images forwarded as base64 + mimetype
    const [imgs] = extractProfileFromImages.mock.calls[0];
    expect(imgs[0].mimeType).toBe('image/png');
    expect(imgs[0].base64).toBe(Buffer.from('imgbytes').toString('base64'));

    const after = await request(app).get('/api/profile');
    expect(after.body.headline).toBe(''); // not persisted
  });

  it('returns 422 with the friendly message when extraction fails', async () => {
    extractProfileFromImages.mockRejectedValue(new Error('Could not read a profile from those images.'));
    const { createApp } = await import('../app.js');
    const app = createApp();
    await withSetup(app);
    const res = await request(app).post('/api/profile/linkedin/vision').attach('images', Buffer.from('x'), 'p.png');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/could not read/i);
  });
});
