// Telegram channel board adapter (community jobs POC — t.me/WePostJobs).
//
// Data source: Telegram's PUBLIC channel web preview
//   https://t.me/s/<channel>          — last ~20 posts, plain HTML, no login
//   https://t.me/s/<channel>?q=<kw>   — server-side message search
// No bot token, no API key, no browser — a plain server-side fetch answers,
// so this board is `rest: true` and cloud-safe (same pattern as LinkedIn
// jobs-guest). The preview markup is shallow and stable; we parse with regex
// like the LinkedIn adapter.
//
// Channel posts are free-text ("Urgent hiring! Accountant — Dubai, send CV to
// hr@…"), so listings are derived heuristically: first line → title, GCC
// city/country mentions → location, mailto/regex → applyEmail. Posts that do
// not look like job ads (channel promos, sticker posts) are dropped.
//
// The source channel is configurable via TELEGRAM_SOURCE_CHANNEL (defaults to
// WePostJobs). The repost pipeline (server/community/telegramRepost.js) reuses
// parseMessages/toListing to forward fresh posts to our own group.

const DEFAULT_CHANNEL = 'WePostJobs';

export function channelName() {
  return (process.env.TELEGRAM_SOURCE_CHANNEL || DEFAULT_CHANNEL).replace(/^@/, '').trim();
}

/**
 * Build a t.me public-preview URL.
 * @param {object} opts
 * @param {string} [opts.keyword] - forwarded to t.me's ?q= message search
 */
export function buildSearchUrl({ keyword } = {}) {
  const params = new URLSearchParams();
  if (keyword) params.set('q', String(keyword).trim());
  const qs = params.toString();
  return `https://t.me/s/${encodeURIComponent(channelName())}${qs ? `?${qs}` : ''}`;
}

// ---- HTML cleaning (same approach as the LinkedIn adapter) ----

function numericEntity(cp) {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, ' ');
}

/** Message text keeps line structure: <br> and closing blocks become \n. */
function htmlToText(html) {
  const withBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n');
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- Job heuristics ----

const JOB_HINT =
  /\b(hiring|vacanc(?:y|ies)|job|position|role|opening|apply|recruit|salary|walk[\s-]?in|urgent|wanted|required|career|interview|cv|resume)\b/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// GCC place names → canonical label shown in the listing.
const GCC_PLACES = [
  ['Dubai', /\bdubai\b/i],
  ['Abu Dhabi', /\babu\s*dhabi\b/i],
  ['Sharjah', /\bsharjah\b/i],
  ['Ajman', /\bajman\b/i],
  ['Ras Al Khaimah', /\bras\s*al[\s-]*khaimah|\brak\b/i],
  ['Fujairah', /\bfujairah\b/i],
  ['UAE', /\buae\b|\bu\.a\.e\b|united arab emirates/i],
  ['Doha', /\bdoha\b/i],
  ['Qatar', /\bqatar\b/i],
  ['Kuwait', /\bkuwait\b/i],
  ['Bahrain', /\bbahrain\b|\bmanama\b/i],
  ['Riyadh', /\briyadh\b/i],
  ['Jeddah', /\bjeddah\b/i],
  ['Dammam', /\bdammam\b/i],
  ['Saudi Arabia', /\bsaudi\b|\bksa\b/i],
  ['Muscat', /\bmuscat\b/i],
  ['Oman', /\boman\b/i],
];

/** True when a post reads like a job ad rather than a promo/announcement. */
export function looksLikeJob(text) {
  return JOB_HINT.test(String(text || ''));
}

export function extractEmail(text) {
  const m = String(text || '').match(EMAIL_RE);
  return m ? m[0] : '';
}

export function extractLocation(text) {
  const found = [];
  for (const [label, re] of GCC_PLACES) {
    if (re.test(text)) found.push(label);
    if (found.length >= 2) break;
  }
  return found.join(', ');
}

/** First meaningful line, stripped of emoji/decoration, as the listing title. */
export function deriveTitle(text) {
  const lines = String(text || '').split('\n');
  for (const raw of lines) {
    const line = raw
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/^[\s#*\-•|:~=_>]+|[\s#*\-•|:~=_<]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (line.length >= 3) return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  return 'Telegram job post';
}

/**
 * Parse a t.me/s/<channel> page into raw messages.
 * Splits on the per-message `data-post="Channel/<id>"` marker so one malformed
 * bubble cannot break the rest (same defensive shape as parseJobCards).
 * @returns {Array<{id: string, url: string, text: string, date: string}>}
 */
export function parseMessages(html) {
  const results = [];
  const chunks = String(html).split(/data-post="/).slice(1);

  for (const chunk of chunks) {
    const postMatch = chunk.match(/^([^"/]+)\/(\d+)"/);
    if (!postMatch) continue;
    const [, channel, id] = postMatch;

    const textMatch = chunk.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    if (!textMatch) continue; // sticker/photo-only post — nothing to list
    const text = htmlToText(textMatch[1]);
    if (!text) continue;

    const dateMatch = chunk.match(/<time[^>]*datetime="([^"]+)"/i);

    results.push({
      id,
      url: `https://t.me/${channel}/${id}`,
      text,
      date: dateMatch ? dateMatch[1] : '',
    });
  }

  return results;
}

/** Normalize a parsed message into the scanner listing contract. */
export function toListing(msg, { country } = {}) {
  const listing = {
    title: deriveTitle(msg.text),
    company: '',
    location: extractLocation(msg.text),
    url: msg.url,
    source: 'telegram',
    description: msg.text,
  };
  if (msg.date) listing.posted = msg.date.slice(0, 10);
  const email = extractEmail(msg.text);
  if (email) listing.applyEmail = email;
  if (country) listing.country = country;
  return listing;
}

const telegram = {
  id: 'telegram',
  name: 'Telegram (community)',
  rest: true, // t.me/s answers a plain server-side fetch — cloud-safe
  status: 'experimental', // POC — single source channel, heuristic parsing

  buildSearchUrl,

  parseListings(html, { country } = {}) {
    return parseMessages(html)
      .filter((m) => looksLikeJob(m.text))
      .map((m) => toListing(m, { country }));
  },
};

export default telegram;
