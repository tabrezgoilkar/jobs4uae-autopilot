import { describe, it, expect } from 'vitest';
import bayt from '../scanner/boards/bayt.js';

// Minimal fixture HTML that matches the selectors used in bayt.js
// (li[data-js-job] → h2.jb-title a, b.jb-company, span.jb-loc)
const FIXTURE = `
<html><body>
  <ul>
    <li data-js-job="1">
      <h2 class="jb-title"><a href="/en/uae/jobs/accountant-12345/">Senior Accountant</a></h2>
      <b class="jb-company">ACME Finance LLC</b>
      <span class="jb-loc">Dubai, UAE</span>
    </li>
    <li data-js-job="2">
      <h2 class="jb-title"><a href="/en/uae/jobs/accountant-67890/">Junior Accountant</a></h2>
      <b class="jb-company">Gulf Holdings</b>
      <span class="jb-loc">Abu Dhabi, UAE</span>
    </li>
    <!-- malformed card (no URL) — should be skipped -->
    <li data-js-job="3">
      <h2 class="jb-title"><a href="">No URL Card</a></h2>
      <b class="jb-company">Mystery Corp</b>
    </li>
    <!-- card with no title — should be skipped -->
    <li data-js-job="4">
      <h2 class="jb-title"><a href="/en/uae/jobs/blank-99999/"></a></h2>
    </li>
  </ul>
</body></html>
`;

describe('bayt board', () => {
  describe('buildSearchUrl', () => {
    it('includes the keyword slug', () => {
      const url = bayt.buildSearchUrl({ keyword: 'accountant', country: 'UAE' });
      expect(url).toContain('accountant-jobs');
    });

    it('includes the country slug for UAE', () => {
      const url = bayt.buildSearchUrl({ keyword: 'accountant', country: 'UAE' });
      expect(url).toContain('/uae/');
    });

    it('handles Saudi Arabia', () => {
      const url = bayt.buildSearchUrl({ keyword: 'engineer', country: 'Saudi Arabia' });
      expect(url).toContain('/saudi-arabia/');
    });

    it('slugifies multi-word keywords', () => {
      const url = bayt.buildSearchUrl({ keyword: 'software engineer', country: 'Qatar' });
      expect(url).toContain('software-engineer-jobs');
      expect(url).toContain('/qatar/');
    });

    it('includes city as a query param when provided', () => {
      const url = bayt.buildSearchUrl({ keyword: 'accountant', country: 'UAE', city: 'Dubai' });
      expect(url).toContain('Dubai');
    });

    it('starts with the Bayt origin', () => {
      const url = bayt.buildSearchUrl({ keyword: 'hr', country: 'Kuwait' });
      expect(url).toMatch(/^https:\/\/www\.bayt\.com/);
    });
  });

  describe('parseListings', () => {
    it('returns 2 valid listings from fixture', () => {
      const listings = bayt.parseListings(FIXTURE);
      expect(listings).toHaveLength(2);
    });

    it('first listing has correct title', () => {
      const [first] = bayt.parseListings(FIXTURE);
      expect(first.title).toBe('Senior Accountant');
    });

    it('first listing has correct company', () => {
      const [first] = bayt.parseListings(FIXTURE);
      expect(first.company).toBe('ACME Finance LLC');
    });

    it('first listing has correct location', () => {
      const [first] = bayt.parseListings(FIXTURE);
      expect(first.location).toBe('Dubai, UAE');
    });

    it('makes relative URLs absolute', () => {
      const [first] = bayt.parseListings(FIXTURE);
      expect(first.url).toMatch(/^https:\/\/www\.bayt\.com/);
    });

    it('source is "bayt"', () => {
      const listings = bayt.parseListings(FIXTURE);
      for (const l of listings) expect(l.source).toBe('bayt');
    });

    it('skips cards with no URL', () => {
      const listings = bayt.parseListings(FIXTURE);
      const noUrl = listings.filter((l) => !l.url);
      expect(noUrl).toHaveLength(0);
    });

    it('skips cards with no title', () => {
      const listings = bayt.parseListings(FIXTURE);
      const noTitle = listings.filter((l) => !l.title);
      expect(noTitle).toHaveLength(0);
    });

    it('returns empty array for empty HTML', () => {
      expect(bayt.parseListings('<html><body></body></html>')).toEqual([]);
    });
  });
});
