// Bot-based community ingestion (phase 2): read job posts with YOUR bot via the
// official Bot API getUpdates — no scraping, no user-account automation.
//
// The bot sees messages from:
//   1. any group it has been added to (source groups like @WePostJobs — admins
//      must add the bot; privacy mode must be disabled via @BotFather), and
//   2. its own private chat — members of a group the bot can't join simply
//      FORWARD job posts to the bot (one tap), no third-party admin needed.
//
// Both arrive as getUpdates messages and flow through the same pipeline:
// filter job-looking text → dedupe (by message + text fingerprint) → format →
// repost to OUR group. Messages already in the destination group are skipped so
// the bot never echoes itself.

import { looksLikeJob, toListing } from '../scanner/boards/telegram.js';

const BOT_API = 'https://api.telegram.org';

/**
 * Fetch pending updates for the bot. Uses the long-poll endpoint with
 * timeout=0 (return immediately) — suited to cron runs, not a daemon.
 * NOTE: getUpdates conflicts with an active webhook on the same bot.
 * @returns {Promise<object[]>} raw Telegram Update objects
 */
export async function getUpdates({ token, offset, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const params = new URLSearchParams({ timeout: '0', allowed_updates: '["message","channel_post"]' });
  if (offset != null) params.set('offset', String(offset));
  const res = await doFetch(`${BOT_API}/bot${token}/getUpdates?${params.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram getUpdates failed (${res.status}): ${body.description || 'unknown error'}`);
  }
  return Array.isArray(body.result) ? body.result : [];
}

/** Stable fingerprint of a post's text so the same job forwarded twice
 *  (e.g. once to the bot chat, once into a group) is only reposted once. */
export function textFingerprint(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 160);
}

/** Best label for where a message came from (forward origin beats chat). */
function sourceLabelOf(m) {
  const fo = m.forward_origin;
  if (fo?.chat?.title) return fo.chat.title;
  if (fo?.chat?.username) return `@${fo.chat.username}`;
  if (fo?.sender_user) return 'forwarded post';
  return m.chat?.title || '';
}

/**
 * Turn raw updates into repostable job posts.
 * Skips: empty/media-only posts, bot-authored messages (incl. our own),
 * anything already in the destination chat, and non-job chatter.
 *
 * @param {object[]} updates - raw Update objects from getUpdates
 * @param {object} opts
 * @param {string|number} [opts.destChatId] - our group's chat id (echo guard)
 * @returns {{ jobs: Array<{key: string, fingerprint: string, sourceLabel: string, listing: object}>, nextOffset: number|null }}
 */
export function extractJobMessages(updates, { destChatId } = {}) {
  const jobs = [];
  let nextOffset = null;

  for (const u of updates) {
    if (typeof u.update_id === 'number') {
      nextOffset = Math.max(nextOffset ?? 0, u.update_id + 1);
    }
    const m = u.message || u.channel_post;
    if (!m) continue;
    const text = (m.text || m.caption || '').trim();
    if (!text) continue;
    if (m.from?.is_bot) continue; // never re-ingest bot posts (incl. our own reposts)
    if (destChatId != null && String(m.chat?.id) === String(destChatId)) continue;
    if (!looksLikeJob(text)) continue;

    // Public chats get a t.me permalink; private chats/forwards have none.
    const url = m.chat?.username ? `https://t.me/${m.chat.username}/${m.message_id}` : '';
    const date = m.date ? new Date(m.date * 1000).toISOString() : '';
    const listing = toListing({ id: String(m.message_id), url, text, date });

    jobs.push({
      key: `${m.chat?.id}:${m.message_id}`,
      fingerprint: textFingerprint(text),
      sourceLabel: sourceLabelOf(m),
      listing,
    });
  }

  return { jobs, nextOffset };
}

/** Drop jobs whose message key or text fingerprint was already reposted. */
export function selectFreshJobs(jobs, state, { limit = 10 } = {}) {
  const seenKeys = new Set(state?.postedKeys || []);
  const seenPrints = new Set(state?.fingerprints || []);
  const fresh = [];
  for (const j of jobs) {
    if (seenKeys.has(j.key) || (j.fingerprint && seenPrints.has(j.fingerprint))) continue;
    seenPrints.add(j.fingerprint); // also dedupe within this batch
    fresh.push(j);
    if (fresh.length >= limit) break;
  }
  return fresh;
}

/** Merge reposted jobs into state, keeping the tails bounded. */
export function markIngested(state, jobs, { keep = 1000 } = {}) {
  return {
    ...state,
    postedKeys: [...(state?.postedKeys || []), ...jobs.map((j) => j.key)].slice(-keep),
    fingerprints: [...(state?.fingerprints || []), ...jobs.map((j) => j.fingerprint).filter(Boolean)].slice(-keep),
  };
}
