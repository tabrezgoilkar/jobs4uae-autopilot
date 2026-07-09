import { fetchHtml } from '../lib/browser.js';
import indeed from './boards/indeed.js';
import freehire from './boards/freehire.js';

// Active, live-verified boards. Aggregators that need a real headed browser +
// XHR interception (Bayt, Naukrigulf) are on the roadmap — see
// docs/superpowers/plans/2026-06-23-NEXT-naukrigulf-bayt-scanner-rework.md.
// freehire is a plain REST/JSON endpoint (no browser).
export const BOARDS = [indeed, freehire];

/**
 * Lightweight JSON fetch for REST boards (no Playwright). Adds a browser-like
 * UA so endpoints that block default fetch UAs still respond.
 */
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; jobs4uae-bot/1.0; +https://github.com/tabrezgoilkar/jobs4uae-autopilot)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Scan a job board and return normalized listings.
 *
 * @param {object} opts
 * @param {string} opts.board     - Board id (e.g. 'indeed')
 * @param {string} opts.keyword   - Search keyword
 * @param {string} [opts.country] - GCC country name
 * @param {string} [opts.city]    - Optional city name
 * @returns {Promise<{listings: Array, error?: string}>}
 */
export async function scan({ board: boardId, keyword, country, city }) {
  const board = BOARDS.find((b) => b.id === boardId);
  if (!board) {
    throw new Error(`Unknown board: ${boardId}`);
  }

  try {
    const url = board.buildSearchUrl({ keyword, country, city });
    const raw = board.rest ? await fetchJson(url) : await fetchHtml(url);
    const listings = board.parseListings(raw, { country });
    return { listings };
  } catch (e) {
    return {
      listings: [],
      error: `Could not read ${board.name} right now.`,
    };
  }
}
