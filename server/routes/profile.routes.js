import { Router } from 'express';
import multer from 'multer';
import { loadProfile, saveProfile } from '../profile/store.js';
import { extractText } from '../profile/extract.js';
import { parseCvText } from '../profile/parse.js';
import { assistProfile } from '../profile/assist.js';
import { normalizeProfile } from '../profile/schema.js';
import { linkedinToProfile, looksLikeLinkedinExport } from '../profile/linkedin/map.js';
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

export function profileRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      res.json(await loadProfile(req.userId));
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
