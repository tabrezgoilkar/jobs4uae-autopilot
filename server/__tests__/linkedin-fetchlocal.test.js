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
// canUseLocalBrowser was removed (Tier 2 is decided via injected fetcher at the
// composition root), so we only test the fetch function here.
import { fetchLinkedinViaLocalBrowser } from '../profile/linkedin/fetchLocal.js';

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
