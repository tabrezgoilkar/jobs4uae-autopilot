// Country name → Indeed regional domain.
// Indeed runs a separate host per country; the GCC ones we support:
const COUNTRY_DOMAINS = {
  'uae': 'ae.indeed.com',
  'united arab emirates': 'ae.indeed.com',
  'saudi arabia': 'sa.indeed.com',
  'ksa': 'sa.indeed.com',
  'qatar': 'qa.indeed.com',
  'kuwait': 'kw.indeed.com',
  'bahrain': 'bh.indeed.com',
  'oman': 'om.indeed.com',
};

const DEFAULT_DOMAIN = 'ae.indeed.com';

function domainFor(country) {
  const key = String(country ?? '').toLowerCase().trim();
  return COUNTRY_DOMAINS[key] ?? DEFAULT_DOMAIN;
}

/**
 * Extract the JSON blob Indeed embeds in the page for its job cards:
 *   window.mosaic.providerData["mosaic-provider-jobcards"]={ ... };
 * The blob is minified JSON; we find the opening brace and balance braces
 * (string-aware) to slice out exactly the object. Returns null if absent.
 */
function extractProviderData(html) {
  const marker = 'providerData["mosaic-provider-jobcards"]=';
  const at = html.indexOf(marker);
  if (at < 0) return null;

  const start = html.indexOf('{', at);
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Indeed.com board adapter (GCC regional sites).
 *
 * Indeed renders its job cards from a JSON blob embedded in the initial HTML
 * (no separate XHR needed). We navigate the public search page (anonymous,
 * no login) and parse that blob — verified live against ae.indeed.com on
 * 2026-06-22. URL/field shape captured from a real response.
 */
const indeed = {
  id: 'indeed',
  name: 'Indeed',
  status: 'verified',

  /**
   * Build an Indeed search URL.
   * Shape: https://<regional-domain>/jobs?q=<keyword>&l=<city|country>
   */
  buildSearchUrl({ keyword, country, city }) {
    const domain = domainFor(country);
    const params = new URLSearchParams();
    params.set('q', String(keyword ?? '').trim());
    const loc = (city && String(city).trim()) || (country && String(country).trim());
    if (loc) params.set('l', loc);
    return `https://${domain}/jobs?${params.toString()}`;
  },

  /**
   * Parse Indeed search result HTML → normalized listings.
   * Reads the embedded mosaic-provider-jobcards JSON; tolerant of the two
   * field spellings Indeed uses (displayTitle/title, company/companyName,
   * jobkey/jobKey).
   */
  parseListings(html, { country } = {}) {
    const data = extractProviderData(html);
    const results = data?.metaData?.mosaicProviderJobCardsModel?.results;
    if (!Array.isArray(results)) return [];

    const origin = `https://${domainFor(country)}`;
    const listings = [];

    for (const r of results) {
      const title = (r.displayTitle || r.title || '').trim();
      const jobKey = r.jobkey || r.jobKey || '';
      if (!title || !jobKey) continue; // skip malformed / sponsored placeholders

      const company = (r.company || r.companyName || '').trim();
      const location =
        (r.formattedLocation || '').trim() ||
        [r.jobLocationCity, r.jobLocationState].filter(Boolean).join(', ').trim();

      // Canonical, clean job URL (avoids the /rc/clk tracking redirect).
      const url = `${origin}/viewjob?jk=${encodeURIComponent(jobKey)}`;

      const salary = r.salarySnippet?.text?.trim() || '';
      const posted = (r.formattedRelativeTime || '').trim();

      listings.push({
        title,
        company,
        location,
        url,
        source: 'indeed',
        ...(salary ? { salary } : {}),
        ...(posted ? { posted } : {}),
      });
    }

    return listings;
  },
};

export default indeed;
