import { Router } from 'express';
import multer from 'multer';
import { loadProfile, saveProfile } from '../profile/store.js';
import { extractText } from '../profile/extract.js';
import { parseCvText } from '../profile/parse.js';
import { normalizeProfile } from '../profile/schema.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export function profileRouter() {
  const router = Router();

  router.get('/', (req, res) => res.json(loadProfile()));

  router.post('/', (req, res) => res.json(saveProfile(req.body ?? {})));

  router.post('/import', upload.single('cv'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
      const text = await extractText(req.file.buffer, req.file.originalname);
      if (!text || !text.trim()) {
        return res.status(422).json({ error: 'Could not read any text from that file.' });
      }
      const engine = createEngine(loadConfig());
      const parsed = await parseCvText(text, engine);
      res.json(normalizeProfile(parsed));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
