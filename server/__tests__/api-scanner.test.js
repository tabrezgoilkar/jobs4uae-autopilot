import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

// Fixture HTML that matches bayt.js selectors
const BAYT_FIXTURE = `
<html><body>
  <ul>
    <li data-js-job="1">
      <h2 class="jb-title"><a href="/en/uae/jobs/accountant-111/">Test Accountant</a></h2>
      <b class="jb-company">Test Corp</b>
      <span class="jb-loc">Dubai, UAE</span>
    </li>
  </ul>
</body></html>
`;

// Mock browser module — must be declared before any imports that use it
vi.mock('../lib/browser.js', () => ({
  fetchHtml: vi.fn(async () => BAYT_FIXTURE),
}));

// Import fetchHtml AFTER the mock so we can inspect it
import { fetchHtml } from '../lib/browser.js';

beforeEach(() => {
  vi.resetModules();
  fetchHtml.mockImplementation(async () => BAYT_FIXTURE);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('scanner API', () => {
  describe('GET /api/scanner/boards', () => {
    it('returns 2 boards', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('board objects have id and name', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      for (const board of res.body) {
        expect(board.id).toBeTruthy();
        expect(board.name).toBeTruthy();
      }
    });

    it('includes bayt and naukrigulf', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp()).get('/api/scanner/boards');
      const ids = res.body.map((b) => b.id);
      expect(ids).toContain('bayt');
      expect(ids).toContain('naukrigulf');
    });
  });

  describe('POST /api/scanner/scan', () => {
    it('returns 200 with listings for a valid request', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'bayt', keyword: 'accountant', country: 'UAE' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.listings)).toBe(true);
      expect(res.body.listings.length).toBeGreaterThan(0);
    });

    it('returned listing has expected fields', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'bayt', keyword: 'accountant', country: 'UAE' });
      const [listing] = res.body.listings;
      expect(listing.title).toBeTruthy();
      expect(listing.url).toMatch(/^https?:\/\//);
      expect(listing.source).toBe('bayt');
    });

    it('returns 400 when keyword is missing', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'bayt' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 400 when keyword is empty string', async () => {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'bayt', keyword: '   ' });
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
        .send({ board: 'bayt', keyword: 'accountant', country: 'UAE' });
      expect(res.status).toBe(200);
      expect(res.body.listings).toEqual([]);
      expect(res.body.error).toBeTruthy();
    });

    it('graceful error message mentions the board name', async () => {
      fetchHtml.mockRejectedValueOnce(new Error('Timeout'));
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/scanner/scan')
        .send({ board: 'naukrigulf', keyword: 'manager', country: 'Qatar' });
      expect(res.status).toBe(200);
      expect(res.body.error).toMatch(/Naukrigulf/i);
    });
  });
});
