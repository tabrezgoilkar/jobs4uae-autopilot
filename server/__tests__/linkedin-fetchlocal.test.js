import { describe, it, expect, vi, afterEach } from 'vitest';

// Hoist the mock fns so they exist BEFORE the vi.mock factories run (vitest hoists
// factories above top-level variable declarations, which would otherwise cause a
// "Cannot access before initialization" TDZ error).
const { extractJsonLd, fetchHtml } = vi.hoisted(() => ({
  extractJsonLd: vi.fn(),
  fetchHtml: vi.fn(),
}));

vi.mock('../profile/linkedin/jsonld.js', async (orig) => {
  const actual = await orig();
  return { ...actual, extractJsonLd };
});
vi.mock('../../lib/browser.js', async (orig) => {
  const actual = await orig();
  return { ...actual, fetchHtml };
});
// canUseLocalBrowser reads env at call-time, so we don't need to mock it.

import { fetchLinkedinViaLocalBrowser, canUseLocalBrowser } from '../profile/linkedin/fetchLocal.js';

describe('fetchLinkedinViaLocalBrowser (Tier 2)', () => {
  it('recovers the Person from rendered HTML and returns via:"local"', async () => {
    fetchHtml.mockResolvedValue('<html><script type="application/ld+json">{"@type":"Person","name":"Jane"}</script></html>');
    extractJsonLd.mockReturnValue({ name: 'Jane' });
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/jane', { fetchHtmlImpl: fetchHtml });
    expect(r.ok).toBe(true);
    expect(r.via).toBe('local');
    expect(fetchHtml).toHaveBeenCalledWith('https://www.linkedin.com/in/jane', expect.objectContaining({ headless: false }));
  });

  it('reports reason:"blocked" when the rendered page has no Person (login wall)', async () => {
    fetchHtml.mockResolvedValue('<html><body>please sign in</body></html>');
    extractJsonLd.mockReturnValue(null);
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/jane', { fetchHtmlImpl: fetchHtml });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('blocked');
  });

  it('reports reason:"blocked" on a network/launch failure (never throws)', async () => {
    fetchHtml.mockRejectedValue(new Error('PAGE_CLOSED'));
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/jane', { fetchHtmlImpl: fetchHtml });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('blocked');
  });
});

describe('canUseLocalBrowser', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('true on the local desktop app (no VERCEL / JOBS4UAE_CLOUD)', () => {
    delete process.env.VERCEL;
    delete process.env.JOBS4UAE_CLOUD;
    expect(canUseLocalBrowser()).toBe(true);
  });
  it('false on Vercel', () => {
    process.env.VERCEL = '1';
    expect(canUseLocalBrowser()).toBe(false);
  });
  it('false when explicitly flagged cloud', () => {
    process.env.JOBS4UAE_CLOUD = '1';
    expect(canUseLocalBrowser()).toBe(false);
  });
});
