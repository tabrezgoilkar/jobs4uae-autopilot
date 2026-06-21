import * as cheerio from 'cheerio';

// Country name → Bayt URL slug
const COUNTRY_SLUGS = {
  'uae': 'uae',
  'united arab emirates': 'uae',
  'saudi arabia': 'saudi-arabia',
  'ksa': 'saudi-arabia',
  'qatar': 'qatar',
  'kuwait': 'kuwait',
  'bahrain': 'bahrain',
  'oman': 'oman',
};

function slugify(str) {
  return encodeURIComponent(
    String(str ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-'),
  );
}

function countrySlug(country) {
  const key = String(country ?? '').toLowerCase().trim();
  return COUNTRY_SLUGS[key] ?? slugify(country);
}

const ORIGIN = 'https://www.bayt.com';

/**
 * Bayt.com board adapter.
 *
 * NOTE: Selectors are best-effort based on Bayt's publicly visible HTML
 * structure as of early 2026. They are not guaranteed to survive Bayt UI
 * changes and MUST be verified + tuned against live responses.
 */
const bayt = {
  id: 'bayt',
  name: 'Bayt.com',

  /**
   * Build a Bayt search URL.
   * Shape: https://www.bayt.com/en/<country-slug>/jobs/<keyword-slug>-jobs/
   */
  buildSearchUrl({ keyword, country, city }) {
    const kSlug = slugify(keyword);
    const cSlug = countrySlug(country || 'uae');
    // City is appended as an extra filter query param when present
    const base = `${ORIGIN}/en/${cSlug}/jobs/${kSlug}-jobs/`;
    if (city) {
      const cityParam = encodeURIComponent(String(city).trim());
      return `${base}?filters%5Bjb_location_country_iso%5D%5B0%5D=${cityParam}`;
    }
    return base;
  },

  /**
   * Parse Bayt search result HTML → normalized listings.
   *
   * GUESSED SELECTORS (needs live verification):
   * - Job card wrapper: li[data-js-job]  OR  div.has-pointer-d
   * - Title: h2.jb-title a  OR  [data-automation-id="job-title"]
   * - Company: span[data-automation-id="job-company"]  OR  b.jb-company
   * - Location: span[data-automation-id="job-location"]  OR  span.jb-loc
   * - Link: a href on the title element
   */
  parseListings(html) {
    const $ = cheerio.load(html);
    const listings = [];

    // Primary selector: job cards are <li> elements with data-js-job attribute
    // Fall back to div.has-pointer-d if the primary selector yields nothing
    const primaryCards = $('li[data-js-job]');
    const cards = primaryCards.length
      ? primaryCards
      : $('div.has-pointer-d');

    cards.each((_, el) => {
      const card = $(el);

      // Helper: pick the first selector that matches at least one element
      const pick = (sels) => {
        for (const sel of sels) {
          const el = card.find(sel).first();
          if (el.length) return el;
        }
        return card.find(sels[sels.length - 1]).first(); // empty-but-safe
      };

      // Title + URL — try multiple selectors
      const titleEl = pick([
        'h2.jb-title a',
        '[data-automation-id="job-title"] a',
        'h2 a',
      ]);
      const title = titleEl.text().trim();
      let url = titleEl.attr('href') ?? '';

      // Company
      const company =
        card.find('b.jb-company').text().trim() ||
        card.find('[data-automation-id="job-company"]').text().trim() ||
        card.find('span.is-black').text().trim();

      // Location
      const location =
        card.find('span.jb-loc').text().trim() ||
        card.find('[data-automation-id="job-location"]').text().trim() ||
        card.find('.t-mute').first().text().trim();

      if (!title || !url) return; // skip malformed

      // Make URL absolute
      if (url.startsWith('/')) url = ORIGIN + url;

      listings.push({ title, company, location, url, source: 'bayt' });
    });

    return listings;
  },
};

export default bayt;
