import { fetchHtml } from '../../lib/browser.js';
import { extractJsonLd, jsonLdToProfile } from './jsonld.js';

/**
 * Tier 2 of the URL-import cascade: read the rendered profile from a REAL (headed)
 * browser on the user's own machine — a residential IP with a real fingerprint,
 * which LinkedIn rarely auth-walls the way it does a server/datacenter IP. This is
 * the same real-browser model already used by the scanner (server/lib/browser.js).
 *
 * Returns the same shape as fetchPublic's result so the route can MERGE it
 * identically: { ok:true, profile, partial:true } | { ok:false, reason:'blocked' }.
 *
 * Whether Tier 2 runs at all is decided at the composition root: the desktop
 * entry (app.js) injects this fetcher into the route, while the cloud entry
 * (cloudApp.js) injects none — so no env check is needed here.
 *
 * @param {string} url
 * @param {{ fetchHtmlImpl?: Function }} [opts] inject a mock in tests.
 */
export async function fetchLinkedinViaLocalBrowser(url, { fetchHtmlImpl = fetchHtml } = {}) {
  let html;
  try {
    // Headed (default) → runs as the user's own browser; never headless (LinkedIn
    // walls automation fingerprints). settleMs lets the SPA render the JSON-LD.
    html = await fetchHtmlImpl(url, { headless: false, settleMs: 4000 });
  } catch {
    return { ok: false, reason: 'blocked' };
  }
  const node = extractJsonLd(html);
  if (!node) return { ok: false, reason: 'blocked' }; // logged-in wall / private profile
  return { ok: true, profile: jsonLdToProfile(node), partial: true, via: 'local' };
}
