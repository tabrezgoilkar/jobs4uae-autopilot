import { extractJsonLd, jsonLdToProfile } from './jsonld.js';

// Fetches a user's OWN public LinkedIn profile by URL and pulls the schema.org
// JSON-LD LinkedIn embeds for search engines. Intended to run on the LOCAL
// companion (residential IP) — from a datacenter IP (e.g. Vercel) LinkedIn
// auth-walls the request, which we surface as `reason: 'blocked'` so the UI can
// fall back to the screenshot/upload path.
//
// ToS posture: user-initiated, the user's own profile, occasional, reading the
// crawler-visible SEO data only. No automation loops, no bulk scraping.

const CRAWLER_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/** True for a `linkedin.com/in/<slug>` profile URL (any scheme/www/trailing bits). */
export function isLinkedinProfileUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  let u;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
  return /^\/in\/[^/]+\/?$/i.test(u.pathname);
}

/**
 * @returns {Promise<{ok:true, profile:object, partial:true} | {ok:false, reason:'bad_url'|'blocked'|'not_found'|'fetch_failed'}>}
 */
export async function fetchLinkedinJsonLd(url, { fetchImpl = fetch } = {}) {
  if (!isLinkedinProfileUrl(url)) return { ok: false, reason: 'bad_url' };

  let res;
  try {
    res = await fetchImpl(url, { headers: { 'User-Agent': CRAWLER_UA, accept: 'text/html' }, redirect: 'follow' });
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  }

  // 999 (LinkedIn's rate/block code), 401, 403 → the request was refused/walled.
  if ([401, 403, 429, 999].includes(res.status)) return { ok: false, reason: 'blocked' };
  if (!res.ok) return { ok: false, reason: 'fetch_failed' };

  const html = await res.text();
  const node = extractJsonLd(html);
  if (!node) return { ok: false, reason: 'blocked' }; // auth wall serves no Person JSON-LD

  return { ok: true, profile: jsonLdToProfile(node), partial: true };
}
