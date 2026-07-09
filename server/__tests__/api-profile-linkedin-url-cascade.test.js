import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Mock ONLY the network fetcher; keep isLinkedinProfileUrl + the router real.
const fetchLinkedinJsonLd = vi.fn();
vi.mock('../profile/linkedin/fetchPublic.js', async (orig) => {
  const actual = await orig();
  return { ...actual, fetchLinkedinJsonLd };
});

let tmpDir;
const partialProfile = (over = {}) => ({
  fullName: 'Jane', headline: 'Engineer', location: 'Dubai', email: '', phone: '',
  summary: '', skills: [], experience: [], education: [], projects: [],
  certifications: [], languages: [], awards: [], links: [], ...over,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  // Clear the module cache so each test gets a fresh profile store in tmpDir.
  vi.resetModules();
  fetchLinkedinJsonLd.mockReset();
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function buildApp(localLinkedinFetcher) {
  const { profileRouter } = await import('../routes/profile.routes.js');
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/profile', profileRouter({ localLinkedinFetcher }));
  return app;
}

describe('POST /api/profile/linkedin/url — 3-tier cascade', () => {
  it('Tier 1 success: merges server-fetched basics and reports via:"server"', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: true, partial: true, via: 'server', profile: partialProfile() });
    const app = await buildApp(async () => { throw new Error('should not be called'); });
    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(200);
    expect(res.body.via).toBe('server');
    expect(res.body.merged.headline).toBe('Engineer');
  });

  it('Tier 2 fallback: when server is blocked and local browser recovers it, merges via:"local"', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    const localFetcher = vi.fn().mockResolvedValue({ ok: true, partial: true, via: 'local', profile: partialProfile() });
    const app = await buildApp(localFetcher);
    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(200);
    expect(res.body.via).toBe('local');
    expect(localFetcher).toHaveBeenCalledWith('https://www.linkedin.com/in/jane');
  });

  it('Tier 2 skipped when no fetcher injected (CLOUD build): blocked server → 409 with offers, no browser call', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    const app = await buildApp(null); // cloud passes no local fetcher → no Playwright in bundle
    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('blocked');
    expect(res.body.offerBookmarklet).toBe(true);
    expect(res.body.offerScreenshots).toBe(true);
  });

  it('Tier 2 also blocked: returns 409 reason:"blocked" with fallback offers', async () => {
    fetchLinkedinJsonLd.mockResolvedValue({ ok: false, reason: 'blocked' });
    const localFetcher = vi.fn().mockResolvedValue({ ok: false, reason: 'blocked' });
    const app = await buildApp(localFetcher);
    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://www.linkedin.com/in/jane' });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('blocked');
    expect(res.body.offerBookmarklet).toBe(true);
    expect(res.body.offerScreenshots).toBe(true);
  });

  it('bad_url: 422 and never fetches, no tier 2', async () => {
    const localFetcher = vi.fn();
    const app = await buildApp(localFetcher);
    const res = await request(app).post('/api/profile/linkedin/url').send({ url: 'https://example.com/x' });
    expect(res.status).toBe(422);
    expect(res.body.reason).toBe('bad_url');
    expect(fetchLinkedinJsonLd).not.toHaveBeenCalled();
    expect(localFetcher).not.toHaveBeenCalled();
  });
});
