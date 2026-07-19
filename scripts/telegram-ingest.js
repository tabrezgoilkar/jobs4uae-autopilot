#!/usr/bin/env node
// Bot-based ingestion CLI: read job posts the bot can see (source groups it
// was added to + posts forwarded to it) and repost them to YOUR group.
//
// Setup (reuses the repost bot):
//   1. @BotFather → /setprivacy → your bot → Disable (lets it read group posts).
//   2. Add the bot to your destination group as admin.
//   3. Optionally: have source-group admins add the bot there too. Until then,
//      just FORWARD job posts to the bot's private chat — same pipeline.
//
// Run:
//   TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_CHAT_ID=-100123456 npm run telegram:ingest
//   npm run telegram:ingest -- --dry-run        # print, send nothing
//   npm run telegram:ingest -- --limit=3        # cap reposts per run (default 10)
//
// State (getUpdates offset + reposted keys/fingerprints) persists in
// data/telegram-ingest-state.json. NOTE: getUpdates conflicts with an active
// webhook on the same bot — this pipeline assumes polling.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getUpdates, extractJobMessages, selectFreshJobs, markIngested } from '../server/community/telegramIngest.js';
import { formatRepostMessage, sendToTelegram } from '../server/community/telegramRepost.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = process.env.TELEGRAM_INGEST_STATE || join(ROOT, 'data', 'telegram-ingest-state.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 10) : 10;

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { offset: null, postedKeys: [], fingerprints: [] };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN.');
  if (!chatId && !dryRun) throw new Error('Set TELEGRAM_CHAT_ID (or use --dry-run).');

  const state = loadState();
  console.log(`Fetching bot updates${state.offset != null ? ` from offset ${state.offset}` : ''}…`);
  const updates = await getUpdates({ token, offset: state.offset });
  const { jobs, nextOffset } = extractJobMessages(updates, { destChatId: chatId });
  console.log(`${updates.length} update(s) → ${jobs.length} job-looking post(s).`);

  const fresh = selectFreshJobs(jobs, state, { limit });
  if (jobs.length > fresh.length) console.log(`${jobs.length - fresh.length} skipped as duplicates/over-limit.`);

  const sent = [];
  for (const j of fresh) {
    const text = formatRepostMessage(j.listing, { sourceLabel: j.sourceLabel });
    if (dryRun) {
      console.log(`\n--- would send (${j.key}) ---\n${text}\n`);
      continue;
    }
    await sendToTelegram({ token, chatId, text });
    console.log(`Reposted ${j.key} (${j.sourceLabel || 'direct'}). ✅`);
    sent.push(j);
    await sleep(1500);
  }

  if (!dryRun) {
    // Advance the offset even when nothing was reposted, so processed
    // updates are acknowledged and don't reappear next run.
    let next = markIngested(state, sent);
    if (nextOffset != null) next = { ...next, offset: nextOffset };
    saveState(next);
  }
  console.log(dryRun ? 'Dry run complete — nothing sent, state untouched.' : `Done — ${sent.length} reposted.`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
