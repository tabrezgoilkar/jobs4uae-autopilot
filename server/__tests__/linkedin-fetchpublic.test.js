import { describe, it, expect } from 'vitest';
import { fetchLinkedinJsonLd, isLinkedinProfileUrl } from '../profile/linkedin/fetchPublic.js';

const PERSON = { '@context': 'http://schema.org', '@type': 'Person', name: 'Jane Doe', jobTitle: 'Engineer' };
const pageWith = (node) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(node)}</script></head></html>`;

/** A fake fetch returning a given status + body. */
const fakeFetch = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

describe('isLinkedinProfileUrl', () => {
  it('accepts profile URLs (www / no-www / trailing slash / query)', () => {
    expect(isLinkedinProfileUrl('https://www.linkedin.com/in/jane-doe')).toBe(true);
    expect(isLinkedinProfileUrl('https://linkedin.com/in/jane/')).toBe(true);
    expect(isLinkedinProfileUrl('http://www.linkedin.com/in/jane?x=1')).toBe(true);
  });
  it('rejects non-profile / non-linkedin URLs', () => {
    expect(isLinkedinProfileUrl('https://www.linkedin.com/company/acme')).toBe(false);
    expect(isLinkedinProfileUrl('https://example.com/in/jane')).toBe(false);
    expect(isLinkedinProfileUrl('not a url')).toBe(false);
    expect(isLinkedinProfileUrl('')).toBe(false);
  });
});

describe('fetchLinkedinJsonLd', () => {
  it('rejects a bad URL without fetching', async () => {
    const r = await fetchLinkedinJsonLd('https://example.com/in/x', { fetchImpl: fakeFetch(200, '') });
    expect(r).toMatchObject({ ok: false, reason: 'bad_url' });
  });

  it('returns a partial profile from a valid page', async () => {
    const r = await fetchLinkedinJsonLd('https://www.linkedin.com/in/jane', { fetchImpl: fakeFetch(200, pageWith(PERSON)) });
    expect(r.ok).toBe(true);
    expect(r.partial).toBe(true);
    expect(r.profile.fullName).toBe('Jane Doe');
  });

  it('reports blocked when the page has no Person block (auth wall)', async () => {
    const r = await fetchLinkedinJsonLd('https://www.linkedin.com/in/jane', { fetchImpl: fakeFetch(200, '<html>authwall</html>') });
    expect(r).toMatchObject({ ok: false, reason: 'blocked' });
  });

  it('maps 999/403 status to blocked', async () => {
    const r = await fetchLinkedinJsonLd('https://www.linkedin.com/in/jane', { fetchImpl: fakeFetch(999, '') });
    expect(r).toMatchObject({ ok: false, reason: 'blocked' });
  });

  it('reports fetch_failed when the fetch throws', async () => {
    const r = await fetchLinkedinJsonLd('https://www.linkedin.com/in/jane', {
      fetchImpl: async () => { throw new Error('network down'); },
    });
    expect(r).toMatchObject({ ok: false, reason: 'fetch_failed' });
  });
});
