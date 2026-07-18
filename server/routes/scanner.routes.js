import { Router } from 'express';
import { CLOUD_BOARDS, allBoards, scan, scanAll, BROWSER_UA } from '../scanner/engine.js';
import { fetchJobDetail } from '../scanner/boards/linkedin.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { estimateSalary } from '../scanner/salary.js';
import { htmlToJobText } from '../scanner/extract.js';
import { assertFetchableUrl } from '../lib/ssrf.js';
import { extractJdSkills } from '../ai/jdSkills.js';
import { optimizeResume } from '../apply/resumeOptimize.js';
import { researchCompany } from '../apply/companyResearch.js';

/**
 * Extract a LinkedIn numeric job id from a pasted job URL, or null if it isn't
 * a recognizable LinkedIn posting link. Handles the common shapes:
 *   linkedin.com/jobs/view/<id>
 *   linkedin.com/jobs/search/?currentJobId=<id>
 *   linkedin.com/jobs/collections/...?jobId=<id>
 */
function linkedInJobId(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const view = u.pathname.match(/\/jobs\/view\/(\d{6,})/i);
    if (view) return view[1];
    const current = u.searchParams.get('currentJobId');
    if (current && /^\d{6,}$/.test(current)) return current;
    const jobId = u.searchParams.get('jobId');
    if (jobId && /^\d{6,}$/.test(jobId)) return jobId;
    return null;
  } catch {
    return null;
  }
}

export function scannerRouter({ cloud = false } = {}) {
  const router = Router();

  /**
   * GET /api/scanner/boards
   * Returns list of supported boards [{id, name, status}]
   */
  router.get('/scanner/boards', async (req, res) => {
    const list = cloud ? CLOUD_BOARDS : await allBoards();
    res.json(list.map(({ id, name, status }) => ({ id, name, status: status ?? 'experimental' })));
  });

  /**
   * POST /api/scanner/jd-skills
   * Body: { jobDescription }
   * Returns 5-category skill classification of a JD (tech_stack, technical_skills,
   * other_skills, required_skills, nice_to_have). Cloud-safe, engine-backed.
   */
  router.post('/scanner/jd-skills', async (req, res) => {
    try {
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      const { jobDescription } = req.body ?? {};
      const engine = createEngine(config);
      res.json(await extractJdSkills(jobDescription, engine));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/optimize
   * Body: { jobText }
   * Returns CrewAI-style structured CV optimization suggestions (before/after per
   * section, skills to highlight, ATS keywords). Cloud-safe, engine-backed, honest.
   */
  router.post('/scanner/optimize', async (req, res) => {
    try {
      const jobText = (req.body?.jobText ?? '').trim();
      if (!jobText) return res.status(400).json({ error: 'Please provide a job description.' });
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      const engine = createEngine(config);
      const profile = await loadProfile(req.userId);
      const suggestions = await optimizeResume({ profile, jobText, engine });
      res.json(suggestions);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/company-research
   * Body: { company }
   * Returns a concise, honest company briefing + likely interview questions.
   * Cloud-safe (engine-backed, setup-wizard gated). No separate search key needed.
   */
  router.post('/scanner/company-research', async (req, res) => {
    try {
      const company = (req.body?.company ?? '').toString().trim();
      if (!company) return res.status(400).json({ error: 'Please provide a company name.' });
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      const engine = createEngine(config);
      const brief = await researchCompany({ company, engine });
      res.json(brief);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/scan
   * Body: { keyword, country?, city?, board? }
   * If `board` is omitted, scans ALL cloud-safe boards and merges results,
   * silently skipping any board that fails (no "local only" noise).
   * Returns: { listings, error? }
   */
  router.post('/scanner/scan', async (req, res) => {
    try {
      const { board, keyword, country, city } = req.body ?? {};

      if (!keyword || !String(keyword).trim()) {
        return res.status(400).json({ error: 'Please enter a keyword to search for.' });
      }

      // No board → scan everything cloud-safe and merge.
      if (!board) {
        const { listings } = await scanAll({ keyword: String(keyword).trim(), country, city, req, cloud });
        return res.json({ listings, error: listings.length ? null : 'No openings found right now. Try a different keyword or country.' });
      }

      const valid = cloud ? CLOUD_BOARDS : await allBoards();
      if (!valid.some((b) => b.id === board)) {
        const validIds = valid.map((b) => b.id).join(', ');
        return res.status(400).json({ error: `Unknown board "${board}". Valid options: ${validIds}.` });
      }

      const result = await scan({ board, keyword: String(keyword).trim(), country, city, req, cloud });
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
   * On the cloud app this needs a browser, so it is unavailable there.
   */
  router.post('/scanner/fetch-job', async (req, res) => {
    const url = (req.body?.url ?? '').toString().trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      return res.status(400).json({ error: 'Please paste a valid job link (starting with http).' });
    }

    // Cloud-safe fast path: a pasted LinkedIn job URL works from datacenter IPs
    // via the public jobs-guest detail API (no browser needed). This is the most
    // common case for UAE jobseekers, so route it before the desktop-only branch.
    const liJobId = cloud ? linkedInJobId(url) : null;
    if (liJobId) {
      try {
        const detail = await fetchJobDetail(liJobId);
        if (!detail || !detail.description) {
          return res.status(422).json({ error: "Couldn't read that LinkedIn posting. It may be expired or private — try the LinkedIn board search instead." });
        }
        return res.json({
          jobText: detail.description,
          source: 'linkedin',
          title: detail.title,
          company: detail.company,
          location: detail.location,
        });
      } catch (e) {
        return res.status(502).json({ error: `Couldn't open that LinkedIn posting (${e.message}). Try the LinkedIn board search instead.` });
      }
    }

    if (cloud) {
      // Generic cloud-safe path: plain server-side fetch + HTML→text extraction.
      // No browser needed. Works for any public posting (company careers pages,
      // job boards, ATS links, etc.). Falls back gracefully if extraction fails.
      try {
        const pin = await assertFetchableUrl(url);
        const resFetch = await fetch(url, {
          headers: { 'user-agent': BROWSER_UA, accept: 'text/html,application/xhtml+xml,*/*' },
          redirect: 'follow',
        });
        if (!resFetch.ok) throw new Error(`Upstream responded ${resFetch.status}`);
        const html = await resFetch.text();
        const jobText = htmlToJobText(html);
        if (!jobText || jobText.length < 40) {
          return res.status(422).json({ error: "Couldn't read a job description from that link. Open it in your browser and paste the text via your CV tools." });
        }
        let host = '';
        try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep blank */ }
        return res.json({ jobText, source: host, title: '', company: '', location: '' });
      } catch (e) {
        const msg = e?.message === 'BLOCKED'
          ? 'That site blocked the fetch (anti-bot). Open it in your browser and paste the description, or try another link.'
          : 'Could not open that link. Check the URL and try again.';
        return res.status(502).json({ error: msg });
      }
    }
    // SSRF guard: only fetch public hosts — never loopback/private/link-local/metadata.
    let pin;
    try {
      pin = await assertFetchableUrl(url);
    } catch {
      return res.status(400).json({ error: "That link points to a private or internal address and can't be fetched. Paste a public job URL." });
    }
    try {
      // Dynamic import keeps Playwright out of the cloud bundle (desktop-only path).
      const { fetchHtml } = await import('../lib/browser.js');
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

  /**
   * POST /api/scanner/linkedin-detail
   * Body: { jobId } → fetches a single LinkedIn posting via the jobs-guest API
   * and returns its normalized detail (description, seniority, etc.).
   * Used by the "view job" flow. Plain server-side fetch (cloud-safe).
   */
  router.post('/scanner/linkedin-detail', async (req, res) => {
    const jobId = String(req.body?.jobId ?? '').trim();
    if (!/^\d{6,}$/.test(jobId)) {
      return res.status(400).json({ error: 'A numeric LinkedIn job id is required.' });
    }
    try {
      // fetchJobDetail defaults to a plain server-side fetch (cloud-safe).
      const detail = await fetchJobDetail(jobId);
      if (!detail) return res.status(404).json({ error: "Couldn't read that LinkedIn posting." });
      res.json(detail);
    } catch (e) {
      const msg = /responded 4|responded 5/i.test(e?.message || '')
        ? 'LinkedIn blocked or rate-limited the fetch. Try again shortly or open the posting in your browser.'
        : 'Could not open that LinkedIn posting right now.';
      res.status(502).json({ error: msg });
    }
  });

  return router;
}
