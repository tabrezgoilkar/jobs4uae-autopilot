// freehire.dev board adapter — unauthenticated REST, JSON (no browser needed).
//
// Endpoint: https://freehire.dev/api/v1/jobs/search  (envelope { data, meta, error })
// Self-hostable via FREEHIRE_API_URL. Tech-focused, multi-market. Gives us a
// second *clean-JSON* UAE/remote source alongside Indeed/LinkedIn.
//
// NOTE: freehire treats `country`/`region` as hints (it may return neighbouring
// markets), so we also surface countries/cities and let the caller narrow. We
// mark status 'experimental' until we confirm live UAE coverage at volume.

const DEFAULT_BASE = 'https://freehire.dev/api/v1';

function baseUrl() {
  return (process.env.FREEHIRE_API_URL || DEFAULT_BASE).replace(/\/$/, '');
}

/**
 * Build a freehire search URL.
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {string} [opts.country]  - ISO-ish country hint (e.g. 'AE')
 * @param {string} [opts.city]
 * @param {string} [opts.remote]   - 'remote' | 'hybrid' | 'onsite'
 * @param {number} [opts.jobAge]   - max age in days
 * @param {number} [opts.limit]
 */
export function buildSearchUrl({ keyword, country, city, remote, jobAge, limit = 25 } = {}) {
  const params = new URLSearchParams();
  if (keyword) params.set('q', String(keyword).trim());
  if (country) params.set('country', String(country).trim());
  if (city) params.set('city', String(city).trim());
  if (/^remote|hybrid|onsite|on-site$/i.test(remote || '')) params.set('work_mode', String(remote).toLowerCase().replace('on-site', 'onsite'));
  if (jobAge && Number(jobAge) > 0 && Number(jobAge) < 9999) params.set('posted_within_days', String(Math.round(Number(jobAge))));
  params.set('limit', String(Math.min(100, Math.max(1, limit))));
  return `${baseUrl()}/jobs/search?${params.toString()}`;
}

function clean(v) {
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v));
}

/**
 * Parse a freehire response envelope → normalized listings.
 * Tolerant of a bare array too (defensive).
 */
export function parseListings(body, { country } = {}) {
  const envelope = typeof body === 'string' ? safeParse(body) : body;
  if (!envelope) return [];
  const results = Array.isArray(envelope) ? envelope : Array.isArray(envelope.data) ? envelope.data : [];
  if (!results.length) return [];

  return results
    .map((j) => {
      const title = clean(j.title);
      if (!title) return null;
      const url = clean(j.url) || (j.public_slug ? `${baseUrl()}/jobs/${j.public_slug}` : '');
      if (!url) return null;
      const e = j.enrichment || {};
      const posted = j.posted_at ? String(j.posted_at).slice(0, 10) : '';
      const listing = {
        title,
        company: clean(j.company),
        location: clean(j.location) || (Array.isArray(j.cities) ? j.cities.join(', ') : ''),
        url,
        source: 'freehire',
        remote: /remote/i.test(j.work_mode || '') ? 'remote' : (/hybrid/i.test(j.work_mode || '') ? 'hybrid' : 'onsite'),
        posted,
        employmentType: clean(e.employment_type),
        minYears: e.experience_years_min ?? null,
        skills: Array.isArray(j.skills) ? j.skills.map((s) => clean(s)).filter(Boolean) : [],
        countries: Array.isArray(j.countries) ? j.countries : [],
        cities: Array.isArray(j.cities) ? j.cities : [],
      };
      if (country) listing.country = country;
      return listing;
    })
    .filter(Boolean);
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

const freehire = {
  id: 'freehire',
  name: 'FreeHire',
  status: 'experimental',
  rest: true, // plain JSON REST endpoint — no headed browser

  buildSearchUrl,

  parseListings(body, opts) {
    return parseListings(body, opts);
  },
};

export default freehire;
