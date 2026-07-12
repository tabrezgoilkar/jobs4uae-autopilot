import { Router } from 'express';
import multer from 'multer';
import { loadProfile, saveProfile } from '../profile/store.js';
import { extractText } from '../profile/extract.js';
import { parseCvText } from '../profile/parse.js';
import { assistProfile } from '../profile/assist.js';
import { normalizeProfile } from '../profile/schema.js';
import { linkedinToProfile, looksLikeLinkedinExport } from '../profile/linkedin/map.js';
import { fetchLinkedinJsonLd, isLinkedinProfileUrl } from '../profile/linkedin/fetchPublic.js';
import { extractProfileFromImages } from '../profile/vision.js';
import { buildBaseline } from '../profile/baseline.js';
import { renderProfileCvPdf } from '../profile/cvPdf.js';
import { renderProfileCvDocx } from '../profile/cvDocx.js';
import { mergeProfile } from '../profile/linkedin/merge.js';
import { bookmarkletCode } from '../profile/linkedin/bookmarklet.js';
import { setPending, takePending } from '../profile/linkedin/pending.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';

// multer@1.x: acceptable for local single-user use; upgrade to 2.x when it is stable.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// The LinkedIn bookmarklet POSTs from the linkedin.com origin, so this one route
// opts into CORS for exactly that origin (the rest of the API stays same-origin).
function corsForLinkedin(req, res, next) {
  if (req.headers.origin === 'https://www.linkedin.com') {
    res.set('Access-Control-Allow-Origin', 'https://www.linkedin.com');
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

export function profileRouter({ localLinkedinFetcher = null } = {}) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      res.json(await loadProfile(req.userId));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Real one-click CV download as PDF — dependency-free (no browser engine), so
  // it is safe on the cloud build. Selectable text, auto-paginated.
  router.get('/pdf', async (req, res) => {
    try {
      const profile = await loadProfile(req.userId);
      const buf = renderProfileCvPdf(profile);
      const safe = (profile.fullName || 'cv').replace(/[^\w.-]+/g, '_');
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${safe}.pdf"`);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Real one-click CV download as Word (.docx) — dependency-free OOXML zip.
  router.get('/docx', async (req, res) => {
    try {
      const profile = await loadProfile(req.userId);
      const buf = renderProfileCvDocx(profile);
      const safe = (profile.fullName || 'cv').replace(/[^\w.-]+/g, '_');
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.set('Content-Disposition', `attachment; filename="${safe}.docx"`);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      res.json(await saveProfile(req.userId, req.body ?? {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/import', upload.single('cv'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
      const text = await extractText(req.file.buffer, req.file.originalname);
      if (!text || !text.trim()) {
        return res.status(422).json({ error: 'Could not read any text from that file.' });
      }
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before importing a CV.' });
      }
      const engine = createEngine(config);
      const parsed = await parseCvText(text, engine);
      res.json(normalizeProfile(parsed));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Import a LinkedIn export (Voyager JSON from the bookmarklet, or an uploaded
  // JSON Resume / .json file) and MERGE it into the saved profile. Returns the
  // merge candidate + a change summary for review — does not persist.
  // The draggable bookmarklet, with this server's own origin baked in.
  router.get('/linkedin/bookmarklet', (req, res) => {
    res.json({ href: bookmarkletCode(`${req.protocol}://${req.get('host')}`) });
  });

  router.use('/linkedin/import', corsForLinkedin);
  router.post('/linkedin/import', upload.single('file'), async (req, res) => {
    try {
      let raw = req.body;
      if (req.file) {
        try {
          raw = JSON.parse(req.file.buffer.toString('utf8'));
        } catch {
          return res.status(422).json({ error: 'That file is not valid JSON.' });
        }
      }
      if (!looksLikeLinkedinExport(raw)) {
        return res.status(422).json({
          error: "That doesn't look like a LinkedIn profile export. Use the bookmarklet on your LinkedIn profile, or upload a JSON Resume file.",
        });
      }
      const incoming = linkedinToProfile(raw);
      const { merged, changes } = mergeProfile(await loadProfile(req.userId), incoming);
      // A bookmarklet import (cross-origin from linkedin.com) is stashed for the
      // app to pick up; a same-origin file upload uses this response directly.
      if (req.headers.origin === 'https://www.linkedin.com') setPending({ merged, changes });
      res.json({ merged, changes });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // The app polls this while the import modal is open; take-once.
  router.get('/linkedin/pending', (req, res) => {
    res.json({ pending: takePending() });
  });

  // Paste-a-URL "instant prefill": a 3-tier cascade that MERGEs the basics
  // (name, headline, location, employers + years, education). Returns the candidate
  // for review, does not persist.
  //
  //   Tier 1 — server-side JSON-LD fetch (works from a residential/permissive IP).
  //   Tier 2 — if Tier 1 is blocked AND this is the LOCAL desktop app, read the
  //            rendered JSON-LD from a headed Chromium on the user's own machine
  //            (residential IP, real fingerprint — LinkedIn rarely walls it).
  //   Tier 3 — bookmarklet / screenshots (the UI offers these when we're blocked).
  //
  // LinkedIn auth-walls datacenter IPs (cloud), so there Tier 1→2 is skipped and we
  // return `reason:'blocked'` for the UI to offer the bookmarklet / screenshots.
  router.post('/linkedin/url', async (req, res) => {
    const url = (req.body?.url ?? '').toString().trim();
    if (!isLinkedinProfileUrl(url)) {
      return res.status(422).json({ error: 'Enter your LinkedIn profile URL (linkedin.com/in/…).', reason: 'bad_url' });
    }
    try {
      let result = await fetchLinkedinJsonLd(url);

      // Tier 2: only on the LOCAL desktop app. The desktop entry injects the
      // real browser fetcher; the cloud build passes none (no display / Playwright
      // is intentionally excluded from the serverless bundle), so this is skipped
      // and we fall straight through to the bookmarklet / screenshots offer.
      if (!result.ok && result.reason === 'blocked' && localLinkedinFetcher) {
        result = await localLinkedinFetcher(url);
      }

      if (!result.ok) {
        const blocked = result.reason === 'blocked';
        return res.status(blocked ? 409 : 502).json({
          reason: result.reason,
          // Tell the UI which fallbacks are actually worth offering.
          offerBookmarklet: true,
          offerScreenshots: true,
          error: blocked
            ? "LinkedIn blocked the request. Use the 1-click bookmarklet (richest) or a screenshot import — both work from your own browser."
            : "Couldn't read that profile. Try the bookmarklet or a screenshot import.",
        });
      }
      const { merged, changes } = mergeProfile(await loadProfile(req.userId), result.profile);
      res.json({ merged, changes, partial: true, via: result.via ?? 'server' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Screenshot import (works everywhere, incl. cloud): read 1+ profile
  // screenshots with a vision model, MERGE, return the candidate for review.
  router.post('/linkedin/vision', upload.array('images', 8), async (req, res) => {
    const files = req.files ?? [];
    if (!files.length) return res.status(400).json({ error: 'Attach at least one screenshot of your profile.' });
    const config = await loadConfig(req.userId);
    if (!config.setupComplete) return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
    try {
      const engine = createEngine(config);
      const images = files.map((f) => ({ base64: f.buffer.toString('base64'), mimeType: f.mimetype }));
      const incoming = await extractProfileFromImages(images, engine);
      const { merged, changes } = mergeProfile(await loadProfile(req.userId), incoming);
      res.json({ merged, changes });
    } catch (e) {
      res.status(422).json({ error: e.message });
    }
  });

  // Auto-build the baseline after an import: fill a blank summary (AI, if set up)
  // and render a deterministic base CV. Works without setup (skips the AI step).
  router.post('/baseline', async (req, res) => {
    try {
      const incoming = req.body?.profile ?? (await loadProfile(req.userId));
      const config = await loadConfig(req.userId);
      const engine = config.setupComplete ? createEngine(config) : null;
      res.json(await buildBaseline(incoming, engine));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Agentic profile assistant: plain-language request → proposed profile update +
  // clarifying questions (NOT saved — the UI confirms, then POSTs to save).
  router.post('/assist', async (req, res) => {
    try {
      const message = (req.body?.message ?? '').toString().trim();
      if (!message) return res.status(400).json({ error: 'Tell the assistant what you want to add or improve.' });
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      const engine = createEngine(config);
      const profile = await loadProfile(req.userId);
      res.json(await assistProfile(profile, message, engine));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
