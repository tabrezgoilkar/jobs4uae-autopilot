import { describe, it, expect } from 'vitest';
import naukrigulf from '../scanner/boards/naukrigulf.js';

// Minimal fixture HTML that matches the selectors used in naukrigulf.js
// (div.ni-job-tuple → a.title, a.comp-name, li.loc)
const FIXTURE = `
<html><body>
  <div class="ni-job-tuple">
    <h2><a class="title" href="/finance-manager-12345">Finance Manager</a></h2>
    <a class="comp-name" href="/company/abc">ABC Corp</a>
    <ul><li class="loc">Dubai, UAE</li></ul>
  </div>
  <div class="ni-job-tuple">
    <h2><a class="title" href="/senior-accountant-67890">Senior Accountant</a></h2>
    <a class="comp-name" href="/company/xyz">XYZ Holdings</a>
    <ul><li class="loc">Riyadh, Saudi Arabia</li></ul>
  </div>
  <!-- malformed — no URL, should be skipped -->
  <div class="ni-job-tuple">
    <h2><a class="title" href="">Empty URL Card</a></h2>
    <a class="comp-name">Ghost Corp</a>
  </div>
  <!-- malformed — no title, should be skipped -->
  <div class="ni-job-tuple">
    <h2><a class="title" href="/no-title-99999"></a></h2>
    <a class="comp-name">Another Corp</a>
  </div>
</body></html>
`;

describe('naukrigulf board', () => {
  describe('buildSearchUrl', () => {
    it('includes the keyword slug', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'accountant', country: 'UAE' });
      expect(url).toContain('accountant-jobs-in');
    });

    it('includes the country slug for UAE', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'accountant', country: 'UAE' });
      expect(url).toContain('uae');
    });

    it('handles Saudi Arabia', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'engineer', country: 'Saudi Arabia' });
      expect(url).toContain('saudi-arabia');
    });

    it('slugifies multi-word keywords', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'software engineer', country: 'Qatar' });
      expect(url).toContain('software-engineer-jobs-in');
      expect(url).toContain('qatar');
    });

    it('appends city slug when provided', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'accountant', country: 'UAE', city: 'Dubai' });
      expect(url).toContain('dubai');
    });

    it('starts with the Naukrigulf origin', () => {
      const url = naukrigulf.buildSearchUrl({ keyword: 'hr', country: 'Kuwait' });
      expect(url).toMatch(/^https:\/\/www\.naukrigulf\.com/);
    });
  });

  describe('parseListings', () => {
    it('returns 2 valid listings from fixture', () => {
      const listings = naukrigulf.parseListings(FIXTURE);
      expect(listings).toHaveLength(2);
    });

    it('first listing has correct title', () => {
      const [first] = naukrigulf.parseListings(FIXTURE);
      expect(first.title).toBe('Finance Manager');
    });

    it('first listing has correct company', () => {
      const [first] = naukrigulf.parseListings(FIXTURE);
      expect(first.company).toBe('ABC Corp');
    });

    it('first listing has correct location', () => {
      const [first] = naukrigulf.parseListings(FIXTURE);
      expect(first.location).toBe('Dubai, UAE');
    });

    it('makes relative URLs absolute', () => {
      const [first] = naukrigulf.parseListings(FIXTURE);
      expect(first.url).toMatch(/^https:\/\/www\.naukrigulf\.com/);
    });

    it('source is "naukrigulf"', () => {
      const listings = naukrigulf.parseListings(FIXTURE);
      for (const l of listings) expect(l.source).toBe('naukrigulf');
    });

    it('skips cards with no URL', () => {
      const listings = naukrigulf.parseListings(FIXTURE);
      const noUrl = listings.filter((l) => !l.url);
      expect(noUrl).toHaveLength(0);
    });

    it('skips cards with no title', () => {
      const listings = naukrigulf.parseListings(FIXTURE);
      const noTitle = listings.filter((l) => !l.title);
      expect(noTitle).toHaveLength(0);
    });

    it('returns empty array for empty HTML', () => {
      expect(naukrigulf.parseListings('<html><body></body></html>')).toEqual([]);
    });
  });
});
