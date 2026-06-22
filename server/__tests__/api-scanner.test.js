import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Real captured Indeed search HTML (embedded mosaic-provider-jobcards JSON).
const INDEED_FIXTURE = readFileSync(join(__dirname, 'fixtures', 'indeed-search.html'), 'utf8');

// Mock browser module — must be declared before any imports that use it
vi.mock('../lib/browser.js', () => ({
  fetchHtml: vi.fn(async () => INDEED_FIXTURE),
}));

// Import fetchHtml AFTER the mock so we can inspect it
import { fetchHtml } from '../lib/browser.js';

beforeEach(() => {
  vi.resetModules();
  fetchHtml.mockImplementation(async () => INDEED_FIXTURE);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('scanner API', () => {
  describe('GET /api/scanner/boards', () => {
    it('returns the active boards', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('board objects have id, name and status', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      for (const board of res.body) {
        expect(board.id).toBeTruthy();
        expect(board.name).toBeTruthy();
        expect(board.status).toBeTruthy();
      }
    });

    it('includes indeed (verified)', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      const indeed = res.body.find((b) => b.id === 'indeed');
      expect(indeed).toBeTruthy();
      expect(indeed.status).toBe('verified');
    });
  });

  describe('POST /api/scanner/scan', () => {
    it('returns 200 with listings for a valid request', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed', keyword: 'accountant', country: 'UAE' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.listings)).toBe(true);
      expect(res.body.listings.length).toBeGreaterThan(0);
    });

    it('returned listing has expected fields', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed', keyword: 'accountant', country: 'UAE' });
      const [listing] = res.body.listings;
      expect(listing.title).toBeTruthy();
      expect(listing.url).toMatch(/^https?:\/\//);
      expect(listing.source).toBe('indeed');
    });

    it('returns 400 when keyword is missing', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 when keyword is empty string', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed', keyword: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 when board is unknown', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'linkedin', keyword: 'engineer' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 when board is missing', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ keyword: 'accountant' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 200 with {listings:[], error} when fetchHtml rejects (graceful failure)', async () => {
      fetchHtml.mockRejectedValueOnce(new Error('Network error'));
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed', keyword: 'accountant', country: 'UAE' });
      expect(res.status).toBe(200);
      expect(res.body.listings).toEqual([]);
      expect(res.body.error).toBeTruthy();
    });

    it('graceful error message mentions the board name', async () => {
      fetchHtml.mockRejectedValueOnce(new Error('Timeout'));
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'indeed', keyword: 'manager', country: 'Qatar' });
      expect(res.status).toBe(200);
      expect(res.body.error).toMatch(/Indeed/i);
    });
  });
});
