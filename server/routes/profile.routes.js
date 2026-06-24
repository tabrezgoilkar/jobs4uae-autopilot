import { Router } from 'express';
import multer from 'multer';
import { loadProfile, saveProfile } from '../profile/store.js';
import { extractText } from '../profile/extract.js';
import { parseCvText } from '../profile/parse.js';
import { normalizeProfile } from '../profile/schema.js';
import { linkedinToProfile, looksLikeLinkedinExport } from '../profile/linkedin/map.js';
import { mergeProfile } from '../profile/linkedin/merge.js';
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

  router.get('/', (req, res) => {
    try {
      res.json(loadProfile());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', (req, res) => {
    try {
      res.json(saveProfile(req.body ?? {}));
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
      const config = loadConfig();
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
  router.use('/linkedin/import', corsForLinkedin);
  router.post('/linkedin/import', upload.single('file'), (req, res) => {
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
      const { merged, changes } = mergeProfile(loadProfile(), incoming);
      res.json({ merged, changes });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
