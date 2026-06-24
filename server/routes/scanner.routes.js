import { Router } from 'express';
import { BOARDS, scan } from '../scanner/engine.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { estimateSalary } from '../scanner/salary.js';
import { fetchHtml } from '../lib/browser.js';
import { htmlToJobText } from '../scanner/extract.js';
import { assertFetchableUrl } from '../lib/ssrf.js';

export function scannerRouter() {
  const router = Router();

  /**
   * GET /api/scanner/boards
   * Returns list of supported boards [{id, name}]
   */
  router.get('/scanner/boards', (req, res) => {
    res.json(BOARDS.map(({ id, name, status }) => ({ id, name, status: status ?? 'experimental' })));
  });

  /**
   * POST /api/scanner/scan
   * Body: { board, keyword, country?, city? }
   * Returns: { listings, error? }
   */
  router.post('/scanner/scan', async (req, res) => {
    try {
      const { board, keyword, country, city } = req.body ?? {};

      if (!keyword || !String(keyword).trim()) {
        return res.status(400).json({ error: 'Please enter a keyword to search for.' });
      }

      const knownBoard = BOARDS.find((b) => b.id === board);
      if (!board || !knownBoard) {
        return res.status(400).json({ error: `Unknown board. Valid options: ${BOARDS.map((b) => b.id).join(', ')}.` });
      }

      const result = await scan({ board, keyword: String(keyword).trim(), country, city });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/salary
   * Body: { title, country?, city? } → AI-estimated GCC salary range (clearly an estimate).
   */
  router.post('/scanner/salary', async (req, res) => {
    try {
      const { title, country, city } = req.body ?? {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Missing job title.' });
      }
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      }
      const engine = createEngine(config);
      const result = await estimateSalary({ title: String(title).trim(), country, city }, engine);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/fetch-job
   * Body: { url } → fetches the job page (headed browser) and returns its text.
   * Used by the "paste a job link" flow; the client then evaluates the text.
   */
  router.post('/scanner/fetch-job', async (req, res) => {
    const url = (req.body?.url ?? '').toString().trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      return res.status(400).json({ error: 'Please paste a valid job link (starting with http).' });
    }
    // SSRF guard: only fetch public hosts — never loopback/private/link-local/metadata.
    let pin;
    try {
      pin = await assertFetchableUrl(url);
    } catch {
      return res.status(400).json({ error: "That link points to a private or internal address and can't be fetched. Paste a public job URL." });
    }
    try {
      // Pin DNS to the validated IP (anti-rebinding) and re-validate every redirect hop.
      const html = await fetchHtml(url, { validateUrl: assertFetchableUrl, hostRules: `MAP ${pin.host} ${pin.ip}` });
      const jobText = htmlToJobText(html);
      if (!jobText || jobText.length < 40) {
        return res.status(422).json({ error: "Couldn't read a job description from that link. Try the listing's main page, or paste the text via your CV tools." });
      }
      let host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep blank */ }
      res.json({ jobText, source: host });
    } catch (e) {
      const msg = e?.message === 'BLOCKED'
        ? 'That site blocked the fetch (anti-bot). Open it in your browser and paste the description, or try another link.'
        : 'Could not open that link. Check the URL and try again.';
      res.status(502).json({ error: msg });
    }
  });

  return router;
}
