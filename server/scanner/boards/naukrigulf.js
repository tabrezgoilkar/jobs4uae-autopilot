import * as cheerio from 'cheerio';

// Country name → Naukrigulf URL slug
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

const ORIGIN = 'https://www.naukrigulf.com';

/**
 * Naukrigulf.com board adapter.
 *
 * NOTE: Selectors are best-effort based on Naukrigulf's publicly visible HTML
 * structure as of early 2026. They are not guaranteed to survive site changes
 * and MUST be verified + tuned against live responses.
 */
const naukrigulf = {
  id: 'naukrigulf',
  name: 'Naukrigulf',

  /**
   * Build a Naukrigulf search URL.
   * Shape: https://www.naukrigulf.com/<keyword-slug>-jobs-in-<country-slug>
   */
  buildSearchUrl({ keyword, country, city }) {
    const kSlug = slugify(keyword);
    const cSlug = countrySlug(country || 'uae');
    const base = `${ORIGIN}/${kSlug}-jobs-in-${cSlug}`;
    if (city) {
      const citySlug = slugify(city);
      return `${base}-${citySlug}`;
    }
    return base;
  },

  /**
   * Parse Naukrigulf search result HTML → normalized listings.
   *
   * GUESSED SELECTORS (needs live verification):
   * - Job card wrapper: div.ni-job-tuple  OR  article.jobTuple
   * - Title: a.title  OR  a[data-ga-track="Job Title"]
   * - Company: a.comp-name  OR  div.comp-name
   * - Location: li.loc  OR  span.location
   * - Link: href on the title <a>
   */
  parseListings(html) {
    const $ = cheerio.load(html);
    const listings = [];

    // Primary selector: each job card
    const cards = $('div.ni-job-tuple, article.jobTuple, div.job-tuple-wrapper').filter((_, el) => {
      // Filter out empty containers
      return $(el).find('a').length > 0;
    });

    cards.each((_, el) => {
      const card = $(el);

      // Title + URL — try multiple selectors
      const titleEl =
        card.find('a.title').first().length
          ? card.find('a.title').first()
          : card.find('a[data-ga-track="Job Title"]').first().length
          ? card.find('a[data-ga-track="Job Title"]').first()
          : card.find('h2 a, h3 a').first();

      const title = titleEl.text().trim();
      let url = titleEl.attr('href') ?? '';

      // Company
      const company =
        card.find('a.comp-name').text().trim() ||
        card.find('div.comp-name').text().trim() ||
        card.find('.company-name').text().trim();

      // Location
      const location =
        card.find('li.loc').text().trim() ||
        card.find('span.location').text().trim() ||
        card.find('.loc-wrapper').text().trim() ||
        card.find('li').first().text().trim();

      if (!title || !url) return; // skip malformed

      // Make URL absolute
      if (url.startsWith('/')) url = ORIGIN + url;

      listings.push({ title, company, location, url, source: 'naukrigulf' });
    });

    return listings;
  },
};

export default naukrigulf;
