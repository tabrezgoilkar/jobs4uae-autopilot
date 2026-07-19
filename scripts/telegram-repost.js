#!/usr/bin/env node
// POC CLI: scrape the public source channel (t.me/s/WePostJobs) and forward
// fresh job posts to YOUR Telegram group via the official Bot API.
//
// Setup (once):
//   1. Create a bot: message @BotFather → /newbot → copy the token.
//   2. Add the bot to your group; make it admin so it can post.
//   3. Find the group chat id: forward a group message to @userinfobot, or
//      call https://api.telegram.org/bot<TOKEN>/getUpdates after posting.
//
// Run:
//   TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_CHAT_ID=-100123456 npm run telegram:repost
//   npm run telegram:repost -- --dry-run          # print, send nothing
//   npm run telegram:repost -- --limit=3          # cap posts per run (default 5)
//   TELEGRAM_SOURCE_CHANNEL=SomeOtherChannel …    # override the source
//
// State (forwarded message ids) persists in data/telegram-repost-state.json
// (data/ is gitignored). Re-running only forwards posts it hasn't seen.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSearchUrl, channelName, parseMessages, looksLikeJob, toListing } from '../server/scanner/boards/telegram.js';
import { formatRepostMessage, selectNewPosts, markPosted, sendToTelegram } from '../server/community/telegramRepost.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = process.env.TELEGRAM_REPOST_STATE || join(ROOT, 'data', 'telegram-repost-state.json');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 5) : 5;

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { postedIds: [] };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const source = channelName();
  const url = buildSearchUrl({});
  console.log(`Scraping https://t.me/s/${source} …`);

  const res = await fetch(url, { headers: { 'user-agent': BROWSER_UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`t.me responded ${res.status} — is the channel public?`);
  const html = await res.text();

  const messages = parseMessages(html);
  const jobs = messages.filter((m) => looksLikeJob(m.text));
  console.log(`Parsed ${messages.length} message(s), ${jobs.length} look like job posts.`);
  if (!messages.length) {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || '(no title)';
    const isPreview = /tgme_widget_message/.test(html);
    console.log(`Diagnostics: page title "${title}", bytes ${html.length}, message markup present: ${isPreview}.`);
    if (!isPreview) {
      console.log('t.me returned the join/landing page — this usually means the source is a GROUP or a preview-restricted channel. The t.me/s/ preview only exists for public CHANNELS.');
    }
  }

  const state = loadState();
  const fresh = selectNewPosts(jobs, state, { limit });
  if (!fresh.length) {
    console.log('Nothing new to forward. ✅');
    return;
  }
  console.log(`${fresh.length} new post(s) to forward (limit ${limit}).`);

  if (!dryRun && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
    throw new Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or use --dry-run).');
  }

  const sentIds = [];
  for (const msg of fresh) {
    const text = formatRepostMessage(toListing(msg), { sourceChannel: source });
    if (dryRun) {
      console.log(`\n--- would send (post ${msg.id}) ---\n${text}\n`);
      continue;
    }
    await sendToTelegram({
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      text,
    });
    console.log(`Forwarded post ${msg.id} → group. ✅`);
    sentIds.push(msg.id);
    await sleep(1500); // stay well inside Bot API rate limits
  }

  if (sentIds.length) saveState(markPosted(state, sentIds));
  console.log(dryRun ? 'Dry run complete — nothing sent, state untouched.' : 'Done.');
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
