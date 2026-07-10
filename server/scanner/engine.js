import { fetchHtml } from '../lib/browser.js';
import indeed from './boards/indeed.js';
import linkedin from './boards/linkedin.js';

// Active, live-verified boards. Aggregators that need a real headed browser +
// XHR interception (Bayt, Naukrigulf) are on the roadmap — see
// docs/superpowers/plans/2026-06-23-NEXT-naukrigulf-bayt-scanner-rework.md.
export const BOARDS = [indeed, linkedin];

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
    const html = await fetchHtml(url);
    const listings = board.parseListings(html, { country });
    return { listings };
  } catch (e) {
    return {
      listings: [],
      error: `Could not read ${board.name} right now.`,
    };
  }
}
