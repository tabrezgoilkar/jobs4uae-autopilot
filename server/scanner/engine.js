import { cached, rateLimit, clientIp } from '../lib/cache.js';
import indeed from './boards/indeed.js';
import linkedin from './boards/linkedin.js';
import freehire from './boards/freehire.js';
import telegram from './boards/telegram.js';

// Cloud-safe boards (plain server-side fetch, no browser) are imported
// statically. The `indeed` board needs a real headed browser + XHR interception
// (desktop companion only) and imports Playwright — so it is loaded lazily via
// dynamic import on the desktop path, keeping Playwright out of the cloud bundle.
export const REST_BOARDS = [linkedin, freehire, telegram];

let browserBoards = null;
async function getBrowserBoards() {
  if (!browserBoards) {
    const mod = await import('./boards/indeed.js');
    browserBoards = [mod.default];
  }
  return browserBoards;
}

export async function allBoards() {
  return [...REST_BOARDS, ...(await getBrowserBoards())];
}

// Boards safe to expose on the cloud (Vercel) app — must NOT require a browser.
export const CLOUD_BOARDS = REST_BOARDS;

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Plain server-side fetch for REST boards (no Playwright). Cached + UA-set. */
export async function fetchRest(url, { ttlMs = 60_000 } = {}) {
  return cached(`rest:${url}`, ttlMs, async () => {
    const res = await fetch(url, {
      headers: { 'user-agent': BROWSER_UA, accept: 'application/json, text/html, */*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Upstream responded ${res.status}`);
    return res.text();
  });
}

/**
 * Scan a job board and return normalized listings.
 *
 * @param {object} opts
 * @param {string} opts.board     - Board id (e.g. 'indeed' | 'linkedin' | 'freehire')
 * @param {string} opts.keyword
 * @param {string} [opts.country]
 * @param {string} [opts.city]
 * @param {object} [opts.req]     - Express request (used for cloud rate-limiting)
 * @param {boolean} [opts.cloud]  - when true, only rest boards are allowed
 */
/**
 * Scan ALL cloud-safe boards for a keyword and merge the results.
 * Boards that fail (rate-limited, upstream error, not ready) are SILENTLY
 * skipped — the user just gets whatever came back. Used by the simplified
 * "Scan jobs" flow so there's no board picker and no "local only" noise.
 *
 * @returns {Promise<{ listings: object[], errors: string[] }>}
 */
export async function scanAll({ keyword, country, city, req, cloud = false } = {}) {
  const boards = cloud ? CLOUD_BOARDS : await allBoards();
  const errors = [];
  const listings = [];
  for (const board of boards) {
    if (cloud && !board.rest) continue; // silently skip browser-only boards on cloud
    try {
      const { listings: found } = await scan({ board: board.id, keyword, country, city, req, cloud });
      for (const l of found) listings.push(l);
    } catch {
      // Silent skip — not ready / failed; never block the other boards.
    }
  }
  return { listings, errors };
}

export async function scan({ board: boardId, keyword, country, city, req, cloud = false }) {
  const boards = cloud ? CLOUD_BOARDS : await allBoards();
  const board = boards.find((b) => b.id === boardId);
  if (!board) throw new Error(`Unknown board: ${boardId}`);
  if (cloud && !board.rest) {
    throw new Error(`The ${board.name} board needs a local browser and is not available on the cloud app.`);
  }

  // Cloud: throttle per IP so the community doesn't collectively hammer upstreams.
  if (cloud && req) {
    const ip = clientIp(req);
    if (!rateLimit(ip, 20, 60_000)) {
      return { listings: [], error: 'Rate limit reached. Please wait a minute before searching again.' };
    }
  }

  try {
    const url = board.buildSearchUrl({ keyword, country, city });
    const raw = board.rest
      ? await fetchRest(url)
      : await (async () => {
          const { fetchHtml } = await import('../lib/browser.js');
          return fetchHtml(url);
        })();
    const listings = board.parseListings(raw, { country });
    return { listings };
  } catch (e) {
    return {
      listings: [],
      error: `Could not read ${board.name} right now${cloud ? ' (upstream may be rate-limiting).' : '.'}`,
    };
  }
}
