import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bookmarkletCode, installPageHtml } from '../profile/linkedin/bookmarklet.js';

describe('bookmarkletCode', () => {
  const code = bookmarkletCode('http://localhost:5123');

  it('is a self-contained javascript: bookmarklet (no external <script> load)', () => {
    expect(code.startsWith('javascript:')).toBe(true);
    // must NOT pull an external loader script (LinkedIn CSP would block it)
    expect(code).not.toMatch(/createElement\(['"]script['"]\)/);
  });

  it('fetches the Voyager profileView same-origin and posts to the given server origin', () => {
    expect(code).toContain('/voyager/api/identity/profiles/');
    expect(code).toContain('http://localhost:5123/api/profile/linkedin/import');
  });

  it('has a file-download fallback when the local POST is blocked', () => {
    expect(code).toContain('linkedin-profile.json');
  });

  it('embeds whatever server origin it is given', () => {
    expect(bookmarkletCode('http://127.0.0.1:9999')).toContain('http://127.0.0.1:9999/api/profile/linkedin/import');
  });
});

describe('installPageHtml', () => {
  it('renders an install page with the draggable bookmarklet', () => {
    const html = installPageHtml('http://localhost:5123');
    expect(html).toMatch(/<a[^>]+href="javascript:/);
    expect(html.toLowerCase()).toContain('linkedin');
  });
});

describe('bookmarklet endpoints', () => {
  it('GET /api/profile/linkedin/bookmarklet returns the href', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/profile/linkedin/bookmarklet');
    expect(res.status).toBe(200);
    expect(res.body.href.startsWith('javascript:')).toBe(true);
  });

  it('GET /linkedin serves the install page', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/linkedin');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/javascript:/);
  });
});
