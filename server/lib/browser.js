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

// Fetch the rendered HTML of a URL (used by scanners).
export async function fetchHtml(url, { timeout = 30000 } = {}) {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    return page.content();
  });
}
