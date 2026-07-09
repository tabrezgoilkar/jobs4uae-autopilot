import { describe, test, expect } from 'vitest';
import freehire, { buildSearchUrl, parseListings } from '../scanner/boards/freehire.js';

const SAMPLE = {
  data: [
    {
      public_slug: 'engineer-sia-abc',
      url: 'https://jobs.smartrecruiters.com/Sia/744-engineer',
      title: 'Backend Engineer',
      company: 'Sia',
      location: 'Brussels, be',
      countries: ['be'],
      regions: ['eu'],
      cities: ['Brussels'],
      skills: ['Go', 'Kubernetes'],
      posted_at: '2026-07-09T11:58:25Z',
      work_mode: 'remote',
      enrichment: { employment_type: 'contract', experience_years_min: 2 },
    },
    {
      public_slug: 'pm-xyz',
      url: 'https://example.com/jobs/pm',
      title: 'Product Manager',
      company: 'Acme',
      location: 'Dubai, ae',
      countries: ['ae'],
      cities: ['Dubai'],
      skills: [],
      posted_at: '2026-07-08T09:00:00Z',
      enrichment: {},
    },
    { title: '', company: 'NoTitle' }, // malformed → skipped
  ],
  meta: { total: 3 },
};

describe('freehire board contract', () => {
  test('shape matches the scanner engine contract', () => {
    expect(freehire.id).toBe('freehire');
    expect(typeof freehire.name).toBe('string');
    expect(freehire.rest).toBe(true);
    expect(typeof freehire.buildSearchUrl).toBe('function');
    expect(typeof freehire.parseListings).toBe('function');
  });
});

describe('buildSearchUrl', () => {
  test('sets q, country, work_mode, limit', () => {
    const u = new URL(buildSearchUrl({ keyword: 'devops', country: 'AE', remote: 'remote', limit: 10 }));
    expect(u.searchParams.get('q')).toBe('devops');
    expect(u.searchParams.get('country')).toBe('AE');
    expect(u.searchParams.get('work_mode')).toBe('remote');
    expect(u.searchParams.get('limit')).toBe('10');
  });

  test('remote/hybrid/onsite map to work_mode', () => {
    expect(new URL(buildSearchUrl({ keyword: 'x', remote: 'hybrid' })).searchParams.get('work_mode')).toBe('hybrid');
    expect(new URL(buildSearchUrl({ keyword: 'x', remote: 'onsite' })).searchParams.get('work_mode')).toBe('onsite');
  });

  test('posted_within_days from jobAge', () => {
    expect(new URL(buildSearchUrl({ keyword: 'x', jobAge: 14 })).searchParams.get('posted_within_days')).toBe('14');
  });

  test('respects FREEHIRE_API_URL override', () => {
    const prev = process.env.FREEHIRE_API_URL;
    process.env.FREEHIRE_API_URL = 'https://selfhost.test/api/v1';
    const u = new URL(buildSearchUrl({ keyword: 'x' }));
    expect(u.origin).toBe('https://selfhost.test');
    process.env.FREEHIRE_API_URL = prev;
  });
});

describe('parseListings', () => {
  test('reshapes the envelope into normalized listings, skipping malformed', () => {
    const listings = parseListings(SAMPLE, { country: 'AE' });
    expect(listings).toHaveLength(2); // the no-title one is dropped

    const [first] = listings;
    expect(first).toMatchObject({
      title: 'Backend Engineer',
      company: 'Sia',
      url: 'https://jobs.smartrecruiters.com/Sia/744-engineer',
      source: 'freehire',
      remote: 'remote',
      employmentType: 'contract',
      minYears: 2,
      skills: ['Go', 'Kubernetes'],
      countries: ['be'],
      cities: ['Brussels'],
      country: 'AE',
    });
    expect(first.posted).toBe('2026-07-09');
  });

  test('handles a bare array and a string body', () => {
    expect(parseListings(SAMPLE.data, {}).length).toBe(2);
    expect(parseListings(JSON.stringify(SAMPLE), {}).length).toBe(2);
  });

  test('empty / unparseable body yields no listings', () => {
    expect(parseListings('', {})).toEqual([]);
    expect(parseListings('not json', {})).toEqual([]);
    expect(parseListings(null, {})).toEqual([]);
  });
});
