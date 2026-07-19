import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import telegram, {
  buildSearchUrl,
  channelName,
  parseMessages,
  looksLikeJob,
  toListing,
} from '../scanner/boards/telegram.js';
import {
  formatRepostMessage,
  selectNewPosts,
  markPosted,
  sendToTelegram,
  escapeHtml,
} from '../community/telegramRepost.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'telegram-channel.html'), 'utf8');

afterEach(() => {
  delete process.env.TELEGRAM_SOURCE_CHANNEL;
  vi.restoreAllMocks();
});

describe('telegram board — URL building', () => {
  it('defaults to the WePostJobs public preview', () => {
    expect(buildSearchUrl({})).toBe('https://t.me/s/WePostJobs');
  });

  it('forwards the keyword to t.me message search', () => {
    expect(buildSearchUrl({ keyword: 'accountant' })).toBe('https://t.me/s/WePostJobs?q=accountant');
  });

  it('honours TELEGRAM_SOURCE_CHANNEL (with or without @)', () => {
    process.env.TELEGRAM_SOURCE_CHANNEL = '@GulfJobsDaily';
    expect(channelName()).toBe('GulfJobsDaily');
    expect(buildSearchUrl({})).toBe('https://t.me/s/GulfJobsDaily');
  });
});

describe('telegram board — message parsing', () => {
  it('parses text messages and skips sticker-only posts', () => {
    const msgs = parseMessages(FIXTURE);
    expect(msgs.map((m) => m.id)).toEqual(['4501', '4502', '4503']); // 4504 = sticker
  });

  it('extracts permalink, date and multi-line text', () => {
    const [msg] = parseMessages(FIXTURE);
    expect(msg.url).toBe('https://t.me/WePostJobs/4501');
    expect(msg.date).toBe('2026-07-18T09:15:33+00:00');
    expect(msg.text).toContain('Urgent Hiring: Senior Accountant');
    expect(msg.text).toContain('Salary: AED 8,000 – 10,000'); // entities decoded
    expect(msg.text.split('\n').length).toBeGreaterThan(2); // <br> kept as lines
  });

  it('filters non-job chatter via looksLikeJob', () => {
    const msgs = parseMessages(FIXTURE);
    expect(looksLikeJob(msgs[0].text)).toBe(true);
    expect(looksLikeJob(msgs[1].text)).toBe(true);
    expect(looksLikeJob(msgs[2].text)).toBe(false); // "share our channel" promo
  });
});

describe('telegram board — listings contract', () => {
  it('produces normalized listings for job posts only', () => {
    const listings = telegram.parseListings(FIXTURE, { country: 'UAE' });
    expect(listings).toHaveLength(2);
    for (const l of listings) {
      expect(l.source).toBe('telegram');
      expect(l.url).toMatch(/^https:\/\/t\.me\//);
      expect(l.title).toBeTruthy();
      expect(l.country).toBe('UAE');
    }
  });

  it('derives title, location, email and posted date heuristically', () => {
    const [accountant, sales] = telegram.parseListings(FIXTURE, {});
    expect(accountant.title).toBe('Urgent Hiring: Senior Accountant');
    expect(accountant.location).toBe('Dubai, UAE');
    expect(accountant.applyEmail).toBe('careers@alnoorgroup.ae');
    expect(accountant.posted).toBe('2026-07-18');

    expect(sales.title).toBe('Walk-in interview tomorrow!');
    expect(sales.location).toContain('Doha');
    expect(sales.applyEmail).toBeUndefined();
  });

  it('is registered as a cloud-safe REST board', async () => {
    const { REST_BOARDS, CLOUD_BOARDS } = await import('../scanner/engine.js');
    const board = REST_BOARDS.find((b) => b.id === 'telegram');
    expect(board).toBeTruthy();
    expect(board.rest).toBe(true);
    expect(CLOUD_BOARDS.some((b) => b.id === 'telegram')).toBe(true);
  });
});

describe('community repost pipeline', () => {
  const jobs = () => parseMessages(FIXTURE).filter((m) => looksLikeJob(m.text));

  it('selects only unseen posts, oldest first, capped by limit', () => {
    const fresh = selectNewPosts(jobs(), { postedIds: ['4501'] }, { limit: 5 });
    expect(fresh.map((m) => m.id)).toEqual(['4502']);
    const capped = selectNewPosts(jobs(), { postedIds: [] }, { limit: 1 });
    expect(capped.map((m) => m.id)).toEqual(['4501']);
  });

  it('markPosted appends ids and bounds the tail', () => {
    const state = markPosted({ postedIds: ['1', '2'] }, ['3'], { keep: 2 });
    expect(state.postedIds).toEqual(['2', '3']);
  });

  it('formats a repost with title, credit link and escaped HTML', () => {
    const listing = toListing(jobs()[0]);
    const text = formatRepostMessage(listing, { sourceChannel: 'WePostJobs' });
    expect(text).toContain('<b>Urgent Hiring: Senior Accountant</b>');
    expect(text).toContain('📍 Dubai, UAE');
    expect(text).toContain('📧 Apply: careers@alnoorgroup.ae');
    expect(text).toContain('<a href="https://t.me/WePostJobs/4501">Original post</a>');
    expect(text).toContain('via @WePostJobs');
  });

  it('escapes angle brackets in user text', () => {
    expect(escapeHtml('<b>x</b> & y')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; y');
  });

  it('sendToTelegram posts to the Bot API and surfaces API errors', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) }));
    const sent = await sendToTelegram({ token: 't0k', chatId: '-100', text: 'hi', fetchImpl: ok });
    expect(sent.message_id).toBe(1);
    const [url, init] = ok.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/bott0k/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '-100', text: 'hi', parse_mode: 'HTML' });

    const bad = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ ok: false, description: 'bot was kicked' }) }));
    await expect(sendToTelegram({ token: 't', chatId: 'c', text: 'x', fetchImpl: bad })).rejects.toThrow(/bot was kicked/);
  });
});
