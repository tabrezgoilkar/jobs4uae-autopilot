import { fetchHtml } from '../../lib/browser.js';
import { extractJsonLd, jsonLdToProfile } from './jsonld.js';

// Tier 2 of the LinkedIn URL-import cascade, for the LOCAL desktop companion.
//
// When the server-side JSON-LD fetch (Tier 1) is IP-walled by LinkedIn, the
// desktop app can fall back to a REAL (headed) Chromium running on the user's
// own residential IP — the same model the scanner uses. This is not bundled
// into the cloud function (the cloud app calls profileRouter() with no
// fetcher, so this file is never imported there).
//
// ToS posture: user-initiated, the user's own profile, occasional, reading the
// crawler-visible SEO data only. Never bulk/scraping.

/**
 * @returns {Promise<{ok:true, profile:object, partial:true, via:'local'} | {ok:false, reason:'blocked'|'not_found'|'fetch_failed'}>}
 */
export async function fetchLinkedinViaLocalBrowser(url, { fetchImpl = fetchHtml } = {}) {
  let html;
  try {
    html = await fetchImpl(url);
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  }
  if (!html || typeof html !== 'string') return { ok: false, reason: 'fetch_failed' };

  const node = extractJsonLd(html);
  if (!node) return { ok: false, reason: 'blocked' }; // auth wall / no Person JSON-LD

  return { ok: true, profile: jsonLdToProfile(node), partial: true, via: 'local' };
}
