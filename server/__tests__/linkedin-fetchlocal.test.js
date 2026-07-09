import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the browser module so the local fetcher doesn't launch Chromium.
vi.mock('../lib/browser.js', () => ({ fetchHtml: vi.fn() }));

import { fetchLinkedinViaLocalBrowser } from '../profile/linkedin/fetchLocal.js';
import { fetchHtml } from '../lib/browser.js';

const PERSON_HTML = `<html><head>
<script type="application/ld+json">{"@type":"Person","name":"Ada Lovelace","jobTitle":"Engineer","address":{"addressLocality":"Dubai"}}</script>
</head><body></body></html>`;

describe('fetchLinkedinViaLocalBrowser (Tier 2)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  test('returns ok with profile when JSON-LD present', async () => {
    fetchHtml.mockResolvedValue(PERSON_HTML);
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/ada');
    expect(r.ok).toBe(true);
    expect(r.via).toBe('local');
    expect(r.profile.fullName).toBe('Ada Lovelace');
    expect(r.profile.location).toBe('Dubai');
  });

  test('returns reason:"blocked" when no Person JSON-LD (auth wall)', async () => {
    fetchHtml.mockResolvedValue('<html><body>Please sign in</body></html>');
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/ada');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('blocked');
  });

  test('returns reason:"fetch_failed" when the page fails to load', async () => {
    fetchHtml.mockRejectedValue(new Error('PAGE_CLOSED'));
    const r = await fetchLinkedinViaLocalBrowser('https://www.linkedin.com/in/ada');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('fetch_failed');
  });

  test('never throws — always a result object', async () => {
    fetchHtml.mockRejectedValue(new Error('BOOM'));
    await expect(fetchLinkedinViaLocalBrowser('x')).resolves.toBeDefined();
  });
});
