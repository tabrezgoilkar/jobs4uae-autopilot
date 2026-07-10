// LinkedIn board adapter (GCC / UAE via the public jobs-guest surface).
//
// Data source: LinkedIn's unauthenticated `jobs-guest` endpoints
//   search : https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
//   detail : https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>
// No login required. The markup is shallow and stable, so we parse with regex
// (a full DOM parser is unnecessary and node-html-parser has nesting bugs on
// LinkedIn cards — confirmed against the upstream reference implementation).
//
// IMPORTANT: runs through the shared scanner fetcher (headed Chromium) like the
// other boards. The jobs-guest surface is more permissive than profile pages,
// but LinkedIn still walls heavy/automated volume — keep usage personal/low and
// prefer a residential IP (the desktop scanner model). Do not mount this on the
// cloud app (it must stay Playwright-free).

const SEARCH_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const DETAIL_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';

// LinkedIn job-age (days) → f_TPR value (seconds). 0/negative/"all" → no filter.
function jobAgeToTpr(days) {
  const n = Number(days);
  if (!n || n <= 0 || n >= 9999) return null;
  return `r${Math.round(n * 86400)}`;
}

// Workplace-type filter: onsite=1, remote=2, hybrid=3.
function workTypeFlag(mode) {
  switch (String(mode || '').toLowerCase()) {
    case 'remote': return '2';
    case 'hybrid': return '3';
    case 'onsite':
    case 'on-site': return '1';
    default: return null;
  }
}

/**
 * Build a LinkedIn jobs-guest search URL.
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {string} [opts.country]  - free-text country/region (e.g. "UAE", "United Arab Emirates")
 * @param {string} [opts.city]     - optional city (e.g. "Dubai")
 * @param {string} [opts.remote]   - 'remote' | 'hybrid' | 'onsite'
 * @param {number} [opts.jobAge]   - max age in days
 * @param {number} [opts.page]     - 1-based page (10 results/page)
 */
export function buildSearchUrl({ keyword, country, city, remote, jobAge, page = 1 } = {}) {
  const params = new URLSearchParams();
  if (keyword) params.set('keywords', String(keyword).trim());
  const loc = (city && String(city).trim()) || (country && String(country).trim()) || 'United Arab Emirates';
  params.set('location', loc);
  const tpr = jobAgeToTpr(jobAge);
  if (tpr) params.set('f_TPR', tpr);
  const wt = workTypeFlag(remote);
  if (wt) params.set('f_WT', wt);
  params.set('start', String(Math.max(0, (Number(page) - 1) * 10)));
  return `${SEARCH_URL}?${params.toString()}`;
}

// ---- HTML entity / tag cleaning (ported from the reference implementation) ----

/** Convert a Unicode code point to a string via fromCodePoint so supplementary-plane chars decode. */
function numericEntity(cp) {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(html) {
  return decodeHtmlEntities(stripTags(html));
}

/** Parse the job ID out of a LinkedIn job-view URL or URN. */
function idFromUrl(url) {
  const m = String(url || '').match(/-(\d{6,})(?:\?|$)/) || String(url || '').match(/(\d{6,})/);
  return m ? m[1] : null;
}

/**
 * Parse the search response: a flat list of <li> job cards. We split on the
 * job-posting URN and parse each chunk independently so one malformed card
 * cannot break the rest.
 */
export function parseJobCards(html) {
  const results = [];
  const chunks = String(html).split(/data-entity-urn="urn:li:jobPosting:/).slice(1);

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const linkMatch = chunk.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);
    const url = linkMatch ? decodeHtmlEntities(linkMatch[1]).split('?')[0] : '';

    let title = null;
    const h3 = chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3) title = clean(h3[1]);
    if (!title) {
      const sr = chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i);
      if (sr) title = clean(sr[1]);
    }
    if (!title) continue;

    let company = null;
    let companyUrl = null;
    const sub = chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i);
    if (sub) {
      const a = sub[1].match(/href="([^"]+)"/i);
      if (a) companyUrl = decodeHtmlEntities(a[1]).split('?')[0];
      company = clean(sub[1]) || null;
    }

    const loc = chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i);
    const location = loc ? clean(loc[1]) || null : null;
    const dt = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i);
    const date = dt ? dt[1] : null;

    results.push({
      id,
      title,
      company,
      companyUrl,
      location,
      date,
      url: url || `https://www.linkedin.com/jobs/view/${id}`,
    });
  }

  return results;
}

/**
 * Parse a single-job detail page into a normalized listing (adds description +
 * criteria). Keeps paragraph/line breaks as newlines.
 */
export function parseJobDetail(html, id) {
  const title = html.match(
    /class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i,
  )?.[1];
  const orgMatch = html.match(
    /class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
  );
  const company = orgMatch ? clean(orgMatch[2]) || null : null;
  const companyUrl = orgMatch ? decodeHtmlEntities(orgMatch[1]).split('?')[0] : null;

  const locMatch = html.match(
    /class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i,
  );
  const location = locMatch ? clean(locMatch[1]) || null : null;

  let description = null;
  const desc = html.match(
    /class="(?:show-more-less-html__markup|description__text[^"]*)"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (desc) {
    const withBreaks = desc[1]
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, '\n');
    description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, '\n\n').trim() || null;
  }

  const criteria = {};
  const itemRe =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let cm;
  while ((cm = itemRe.exec(html)) !== null) {
    criteria[clean(cm[1]).toLowerCase()] = clean(cm[2]);
  }

  const applyMatch = html.match(/class="topcard__link[^"]*"[^>]*href="([^"]+)"/i);
  const applyUrl = applyMatch ? decodeHtmlEntities(applyMatch[1]).split('?')[0] : null;

  return {
    id,
    title: title ? clean(title) : '(untitled)',
    company,
    companyUrl,
    location,
    date: null,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    description,
    seniority: criteria['seniority level'] ?? null,
    employmentType: criteria['employment type'] ?? null,
    jobFunction: criteria['job function'] ?? null,
    industries: criteria['industries'] ?? null,
    applyUrl,
  };
}

/** Normalize parsed cards into the scanner listing contract. */
function toListing(card, { country } = {}) {
  const listing = {
    title: card.title,
    company: card.company || '',
    location: card.location || '',
    url: card.url,
    source: 'linkedin',
  };
  if (card.date) listing.posted = card.date;
  if (card.companyUrl) listing.companyUrl = card.companyUrl;
  // Surface the posting id for downstream detail fetch.
  listing.jobId = card.id;
  if (country) listing.country = country;
  return listing;
}

/**
 * Fetch a single posting's detail (used by the "view job" / paste-link flow).
 * @param {string} jobId
 * @param {(url:string)=>Promise<string>} fetchHtml
 * @returns {Promise<object|null>}
 */
export async function fetchJobDetail(jobId, fetchHtml) {
  const url = `${DETAIL_URL}/${encodeURIComponent(jobId)}`;
  const html = await fetchHtml(url);
  if (!html) return null;
  return parseJobDetail(html, String(jobId));
}

const linkedin = {
  id: 'linkedin',
  name: 'LinkedIn',
  status: 'experimental', // jobs-guest can rate-limit; verify live before marking verified

  buildSearchUrl,

  parseListings(html, { country } = {}) {
    const cards = parseJobCards(html);
    if (!cards.length) return [];
    return cards.map((c) => toListing(c, { country }));
  },
};

export default linkedin;
