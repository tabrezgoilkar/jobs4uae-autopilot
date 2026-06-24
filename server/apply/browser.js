import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { dataDir } from '../config/paths.js';

// Headed, persistent per-board browser for assisted apply. The user logs in here
// themselves and clicks Submit themselves — we only keep the SESSION (cookies in a
// local profile dir), never passwords, and never call a submit control.
//
// This module talks to a real browser, so it is verified manually (like the
// scanner). The autofill ORCHESTRATION is unit-tested via a fake adapter; here we
// only provide the thin real adapter + session/window lifecycle.

const live = new Map(); // board id -> { context, page }

function profileDir(board) {
  return path.join(dataDir(), 'browser', board);
}

/** A page adapter matching the shape autofill.js expects. */
export function makeAdapter(page) {
  const tryEl = async (selector, fn) => {
    const el = await page.$(selector);
    if (!el) return false;
    try { await fn(el); return true; } catch { return false; }
  };
  return {
    fillField: (selector, value) => tryEl(selector, (el) => el.fill(String(value))),
    setText: (selector, value) => tryEl(selector, (el) => el.fill(String(value))),
    uploadFile: (selector, filePath) => tryEl(selector, (el) => el.setInputFiles(filePath)),
    // Best-effort heuristic: labelled inputs/selects/textareas still empty, minus
    // file inputs and obvious contact fields. Real-world tuning is per-board + manual.
    detectQuestions: () =>
      page.$$eval('form label', (labels) =>
        labels
          .map((label, i) => {
            const ctrl = label.htmlFor
              ? document.getElementById(label.htmlFor)
              : label.querySelector('input,select,textarea');
            if (!ctrl) return null;
            const type = (ctrl.getAttribute('type') || ctrl.tagName).toLowerCase();
            if (type === 'file' || type === 'hidden' || type === 'submit') return null;
            if ('value' in ctrl && ctrl.value && String(ctrl.value).trim()) return null; // already filled
            const labelText = (label.textContent || '').trim();
            if (!labelText) return null;
            const selector = ctrl.id ? `#${CSS.escape(ctrl.id)}` : `form label:nth-of-type(${i + 1}) :is(input,select,textarea)`;
            return { id: ctrl.id || `q${i}`, selector, label: labelText, type };
          })
          .filter(Boolean),
      ),
  };
}

/** Open a headed persistent window at the board's login page; keep it open. */
export async function connect(board) {
  if (live.has(board.id)) return { ok: true, already: true };
  const context = await chromium.launchPersistentContext(profileDir(board.id), {
    headless: false,
    viewport: null,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(board.loginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  live.set(board.id, { context, page });
  return { ok: true };
}

/** Best-effort: probe a logged-in-only URL; if it doesn't bounce to login, treat as connected. */
export async function confirm(board) {
  const entry = live.get(board.id);
  if (!entry) return { connected: false };
  if (!board.loggedInProbe) return { connected: true }; // user-asserted only
  try {
    await entry.page.goto(board.loggedInProbe, { waitUntil: 'domcontentloaded' });
    const url = entry.page.url();
    return { connected: !/login|signin|account\/login/i.test(url) };
  } catch {
    return { connected: true }; // network hiccup — trust the user's confirmation
  }
}

/** Open a job in the (already connected) window and return an autofill adapter. */
export async function openJobPage(board, jobUrl) {
  let entry = live.get(board.id);
  if (!entry) {
    await connect(board);
    entry = live.get(board.id);
  }
  await entry.page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
  return { adapter: makeAdapter(entry.page), page: entry.page };
}

/** Close the window and delete the saved session for a board. */
export async function disconnect(board) {
  const entry = live.get(board.id);
  if (entry) {
    await entry.context.close().catch(() => {});
    live.delete(board.id);
  }
  fs.rmSync(profileDir(board.id), { recursive: true, force: true });
  return { ok: true };
}

export function isOpen(boardId) {
  return live.has(boardId);
}
