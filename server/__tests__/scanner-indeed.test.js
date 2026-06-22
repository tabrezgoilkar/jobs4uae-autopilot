import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import indeed from '../scanner/boards/indeed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'indeed-search.html'), 'utf8');

describe('indeed board', () => {
  describe('buildSearchUrl', () => {
    it('uses the UAE regional domain by default', () => {
      const url = indeed.buildSearchUrl({ keyword: 'accountant', country: 'UAE' });
      expect(url).toMatch(/^https:\/\/ae\.indeed\.com\/jobs\?/);
      expect(url).toContain('q=accountant');
      expect(url).toContain('l=UAE');
    });

    it('maps each GCC country to its own Indeed host', () => {
      const host = (c) => new URL(indeed.buildSearchUrl({ keyword: 'x', country: c })).host;
      expect(host('Saudi Arabia')).toBe('sa.indeed.com');
      expect(host('Qatar')).toBe('qa.indeed.com');
      expect(host('Kuwait')).toBe('kw.indeed.com');
      expect(host('Bahrain')).toBe('bh.indeed.com');
      expect(host('Oman')).toBe('om.indeed.com');
    });

    it('prefers city over country for the location filter', () => {
      const url = indeed.buildSearchUrl({ keyword: 'nurse', country: 'UAE', city: 'Dubai' });
      expect(url).toContain('l=Dubai');
    });

    it('falls back to the default domain for an unknown country', () => {
      const url = indeed.buildSearchUrl({ keyword: 'x', country: 'Narnia' });
      expect(new URL(url).host).toBe('ae.indeed.com');
    });

    it('encodes multi-word keywords safely', () => {
      const url = indeed.buildSearchUrl({ keyword: 'senior accountant', country: 'UAE' });
      expect(url).toContain('q=senior+accountant');
    });
  });

  describe('parseListings (real captured fixture)', () => {
    const listings = indeed.parseListings(FIXTURE, { country: 'UAE' });

    it('extracts every job card from the embedded JSON', () => {
      expect(listings).toHaveLength(3);
    });

    it('maps title, company and location from the real shape', () => {
      expect(listings[0]).toMatchObject({
        title: 'Junior Accountant - Must be in Dubai',
        company: 'Audiix Accounting & Bookkeeping',
        location: 'Dubai',
        source: 'indeed',
      });
    });

    it('builds a clean canonical viewjob URL from the job key', () => {
      for (const l of listings) {
        expect(l.url).toMatch(/^https:\/\/ae\.indeed\.com\/viewjob\?jk=[a-z0-9]+$/);
      }
    });

    it('includes salary and posted date when present', () => {
      const withSalary = listings.find((l) => l.salary);
      expect(withSalary?.salary).toMatch(/AED/);
      expect(listings.every((l) => typeof l.posted === 'string')).toBe(true);
    });

    it('returns [] for HTML with no embedded job data', () => {
      expect(indeed.parseListings('<html><body>nothing here</body></html>')).toEqual([]);
    });
  });

  it('is marked verified in its status', () => {
    expect(indeed.status).toBe('verified');
  });
});
