import { fetchHtml } from '../lib/browser.js';
import bayt from './boards/bayt.js';
import naukrigulf from './boards/naukrigulf.js';

export const BOARDS = [bayt, naukrigulf];

/**
 * Scan a job board and return normalized listings.
 *
 * @param {object} opts
 * @param {string} opts.board     - Board id (e.g. 'bayt', 'naukrigulf')
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
    const listings = board.parseListings(html);
    return { listings };
  } catch (e) {
    return {
      listings: [],
      error: `Could not read ${board.name} right now.`,
    };
  }
}
