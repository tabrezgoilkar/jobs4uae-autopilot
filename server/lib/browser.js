import { chromium } from 'playwright';

// Shared browser helpers. Headless is used for PDF rendering (Phase 5) and
// scanning (Phase 7). A visible/headed browser for the assisted-apply
// Connections flow comes later (Phase 11). Server modules should import these
// and unit tests should mock this module (vi.mock('../lib/browser.js')).

export async function withPage(fn, { headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// Render an HTML string to a PDF Buffer (A4, sensible print margins).
export async function renderPdfFromHtml(html, { format = 'A4', margin } = {}) {
  return withPage(async (page) => {
    await page.setContent(html, { waitUntil: 'networkidle' });
    return page.pdf({
      format,
      printBackground: true,
      margin: margin ?? { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
  });
}

// A realistic desktop Chrome UA — job boards (Indeed etc.) sit behind
// Cloudflare and block the default headless fingerprint.
const SCAN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch the rendered HTML of a URL (used by scanners).
 *
 * Runs a HEADED Chromium with light anti-automation hardening because the GCC
 * job boards are behind Cloudflare and reject headless/automation traffic
 * (verified 2026-06-22: headless Indeed → "Blocked", headed → full results).
 * A visible browser window is expected during a scan — this is the same
 * real-browser-on-the-user's-machine model used for assisted apply, and it
 * keeps scanning anonymous (no login). Pass { headless: true } in tests.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeout=45000]
 * @param {boolean} [opts.headless=false]
 * @param {number} [opts.settleMs=3500]  Wait after load for content to render.
 */
// Title/markers that mean the board served an anti-bot block instead of results.
const BLOCK_MARKERS = [
  'Just a moment',
  'Security Check',
  'Blocked - Indeed',
  'Additional Verification Required',
  'Please verify you are a human',
];

export async function fetchHtml(url, { timeout = 45000, headless = false, settleMs = 3500 } = {}) {
  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    const context = await browser.newContext({
      userAgent: SCAN_USER_AGENT,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    // Swallow late frame/navigation errors so a page closing mid-challenge
    // never surfaces as an unhandled rejection.
    page.on('crash', () => {});
    page.on('pageerror', () => {});

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    // Best-effort settle; if the page is torn down mid-wait, don't crash.
    if (settleMs) await page.waitForTimeout(settleMs).catch(() => {});

    let html = '';
    try {
      html = await page.content();
    } catch {
      throw new Error('PAGE_CLOSED');
    }

    if (BLOCK_MARKERS.some((m) => html.includes(m))) {
      throw new Error('BLOCKED');
    }
    return html;
  } finally {
    await browser.close().catch(() => {});
  }
}
