import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Mock the network fetchers; keep isLinkedinProfileUrl + merge logic real.
const fetchLinkedinJsonLd = vi.fn();
vi.mock('../profile/linkedin/fetchPublic.js', async (orig) => {
  const actual = await orig();
  return { ...actual, fetchLinkedinJsonLd };
});

const fetchLinkedinViaLocalBrowser = vi.fn();
vi.mock('../profile/linkedin/fetchLocal.js', () => ({ fetchLinkedinViaLocalBrowser }));

const partialProfile = (over = {}) => ({
  fullName: 'Jane Doe', email: '', phone: '', location: '', headline: 'Engineer', summary: '',
  skills: [], experience: [], education: [], projects: [], certifications: [], languages: [], awards: [], links: [],
  ...over,
});

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  fetchLinkedinJsonLd.mockReset();
  fetchLinkedinViaLocalBrowser.mockReset();
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/profile/linkedin/url', () => {
  it('returns 422 for a non-profile URL and never fetches', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://example.com/x' });
    expect(res.status).toBe(422);
    expect(res.body.reason).toBe('bad_url');
    expect(fetchLinkedinJsonLd).not.toHaveBeenCalled();
  });

  it('merges a fetched partial profile and returns { merged, changes, partial, via } without saving', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({
      ok: true, partial: true, via: 'server',
      profile: partialProfile({ experience: [{ company: 'Acme', title: '', startDate: '2020', endDate: 'Present', description: '' }] }),
    });
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Jane A. Doe' });

    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(200);
    expect(res.body.partial).toBe(true);
    expect(res.body.via).toBe('server');
    expect(res.body.merged.fullName).toBe('Jane A. Doe');
    expect(res.body.merged.headline).toBe('Engineer');
    expect(res.body.changes.added.experience).toBe(1);

    const after = await request(app).get('/api/profile');
    expect(after.body.headline).toBe('');
  });

  it('falls back to the injected local browser (Tier 2) when server fetch is blocked', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    fetchLinkedinViaLocalBrowser.mockResolvedValue({
      ok: true, partial: true, via: 'local',
      profile: partialProfile({ location: 'Dubai' }),
    });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(fetchLinkedinViaLocalBrowser).toHaveBeenCalledWith('https://www.linkedin.com/in/jane');
    expect(res.status).toBe(200);
    expect(res.body.via).toBe('local');
    expect(res.body.merged.location).toBe('Dubai');
  });

  it('returns 409 with reason "blocked" when both tiers are walled (UI offers screenshots)', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    fetchLinkedinViaLocalBrowser.mockResolvedValue({ ok: false, reason: 'blocked' });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('blocked');
    expect(res.body.offerScreenshots).toBe(true);
  });
});
