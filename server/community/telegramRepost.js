// Community repost pipeline (POC): forward fresh job posts from a public
// source channel (t.me/WePostJobs) to OUR Telegram group via the official Bot
// API. From there the community sees curated posts, and the scanner's
// `telegram` board picks the same source up for in-app fit scoring.
//
// Assisted, never spammy: dedupe against previously-forwarded message ids,
// oldest-first, capped per run, and every repost credits + links the original
// post. Requires a bot YOU created (@BotFather) that is a member of YOUR
// group — no user-account automation, official API only.

const BOT_API = 'https://api.telegram.org';

/** Escape user text for Telegram parse_mode: 'HTML'. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format one scanner listing (from the telegram board) as a repost message.
 * Telegram HTML supports <b>/<i>/<a>; keep it compact — title, key facts,
 * a teaser of the original text, and credit back to the source post.
 */
export function formatRepostMessage(listing, { sourceChannel, sourceLabel } = {}) {
  const lines = [`💼 <b>${escapeHtml(listing.title)}</b>`];
  if (listing.location) lines.push(`📍 ${escapeHtml(listing.location)}`);
  if (listing.applyEmail) lines.push(`📧 Apply: ${escapeHtml(listing.applyEmail)}`);

  const teaser = String(listing.description || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (teaser) {
    lines.push('');
    lines.push(escapeHtml(teaser.length > 350 ? `${teaser.slice(0, 347)}…` : teaser));
  }

  lines.push('');
  // Public posts get a permalink; private-group/forwarded posts have none —
  // credit the source by name instead.
  const creditName = sourceChannel ? `@${sourceChannel}` : sourceLabel || '';
  if (listing.url) {
    lines.push(`🔗 <a href="${escapeHtml(listing.url)}">Original post</a>${creditName ? ` · via ${escapeHtml(creditName)}` : ''}`);
  } else if (creditName) {
    lines.push(`📢 via ${escapeHtml(creditName)}`);
  }
  lines.push('🤖 Shared by Jobs4UAE Autopilot — free GCC job copilot');
  return lines.join('\n');
}

/**
 * Pick the messages not forwarded yet, oldest first, capped at `limit`.
 * @param {Array<{id: string}>} messages - parsed source-channel messages
 * @param {{ postedIds?: string[] }} state - persisted repost state
 */
export function selectNewPosts(messages, state, { limit = 5 } = {}) {
  const seen = new Set(state?.postedIds || []);
  return messages
    .filter((m) => !seen.has(m.id))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .slice(0, Math.max(0, limit));
}

/** Merge freshly-forwarded ids into state, keeping the tail bounded. */
export function markPosted(state, ids, { keep = 500 } = {}) {
  const postedIds = [...(state?.postedIds || []), ...ids.map(String)].slice(-keep);
  return { ...state, postedIds };
}

/**
 * Send one message to a chat via the Bot API.
 * @param {object} opts
 * @param {string} opts.token   - bot token from @BotFather
 * @param {string} opts.chatId  - target group/channel chat id (e.g. -100123…)
 * @param {string} opts.text    - HTML-formatted message
 * @param {typeof fetch} [opts.fetchImpl] - injectable for tests
 */
export async function sendToTelegram({ token, chatId, text, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(`${BOT_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body.description || 'unknown error'}`);
  }
  return body.result;
}
