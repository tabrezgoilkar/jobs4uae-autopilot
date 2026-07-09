import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Mock ONLY the network fetchers; keep isLinkedinProfileUrl + the tier logic real.
const fetchLinkedinJsonLd = vi.fn();
const fetchLinkedinViaLocalBrowser = vi.fn();
vi.mock('../profile/linkedin/fetchPublic.js', async (orig) => {
  const actual = await orig();
  return { ...actual, fetchLinkedinJsonLd };
});
vi.mock('../profile/linkedin/fetchLocal.js', async (orig) => {
  const actual = await orig();
  return { ...actual, fetchLinkedinViaLocalBrowser };
});

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  fetchLinkedinJsonLd.mockReset();
  fetchLinkedinViaLocalBrowser.mockReset();
  // Default env under test: the LOCAL desktop app (Tier 2 allowed).
  delete process.env.VERCEL;
  delete process.env.JOBS4UAE_CLOUD;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/profile/linkedin/url — 3-tier cascade', () => {
  it('Tier 1 success: merges server-fetched basics and reports via:"server"', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({
      ok: true, partial: true, via: 'server',
      profile: { fullName: 'Jane', headline: 'Engineer', location: 'Dubai', experience: [], education: [] },
    });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(200);
    expect(res.body.via).toBe('server');
    expect(res.body.merged.headline).toBe('Engineer');
    expect(fetchLinkedinViaLocalBrowser).not.toHaveBeenCalled();
  });

  it('Tier 2 fallback: when server is blocked and local browser recovers it, merges via:"local"', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    fetchLinkedinViaLocalBrowser.mockResolvedValue({
      ok: true, partial: true, via: 'local',
      profile: { fullName: 'Jane', headline: 'Engineer', location: 'Dubai', experience: [], education: [] },
    });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(200);
    expect(res.body.via).toBe('local');
    expect(res.body.merged.fullName).toBe('Jane');
  });

  it('Tier 2 skipped on cloud (VERCEL): blocked server → 409 with reason:"blocked", no local browser', async () => {
    process.env.VERCEL = '1';
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('blocked');
    expect(res.body.offerBookmarklet).toBe(true);
    expect(res.body.offerScreenshots).toBe(true);
    expect(fetchLinkedinViaLocalBrowser).not.toHaveBeenCalled();
  });

  it('Tier 2 also blocked: returns 409 reason:"blocked" with fallback offers (UI shows bookmarklet/screenshots)', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    fetchLinkedinViaLocalBrowser.mockResolvedValue({ ok: false, reason: 'blocked' });
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('blocked');
    expect(res.body.offerBookmarklet).toBe(true);
    expect(res.body.offerScreenshots).toBe(true);
  });
});
