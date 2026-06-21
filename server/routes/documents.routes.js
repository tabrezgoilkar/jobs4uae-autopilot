import { Router } from 'express';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { loadProfile } from '../profile/store.js';
import { getEvaluation } from '../evaluate/store.js';
import { generateDocuments } from '../documents/engine.js';
import { listDocuments, addDocument, getDocument, updateDocument } from '../documents/store.js';

export function documentsRouter() {
  const router = Router();

  router.post('/documents/generate', async (req, res) => {
    try {
      const config = loadConfig();
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before generating documents.' });
      }

      let jobText = (req.body?.jobText ?? '').trim();
      let jobTitle = req.body?.jobTitle ?? '';
      let company = req.body?.company ?? '';
      const evaluationId = req.body?.evaluationId ?? null;

      if (evaluationId) {
        const ev = getEvaluation(evaluationId);
        if (!ev) return res.status(404).json({ error: 'Evaluation not found.' });
        jobText = (ev.jobText ?? jobText ?? '').trim();
        jobTitle = jobTitle || ev.jobTitle || '';
        company = company || ev.company || '';
      }

      if (!jobText) {
        return res.status(400).json({ error: 'Please provide a job description, or pick an evaluated job.' });
      }

      const engine = createEngine(config);
      const profile = loadProfile();
      const docs = await generateDocuments(profile, jobText, engine);
      res.json({ ...docs, jobTitle, company, evaluationId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/documents', (req, res) => {
    try {
      res.json(listDocuments());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/documents', (req, res) => {
    try {
      res.json(addDocument(req.body ?? {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/documents/:id', (req, res) => {
    try {
      const found = getDocument(req.params.id);
      if (!found) return res.status(404).json({ error: 'Document not found.' });
      res.json(found);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/documents/:id', (req, res) => {
    try {
      const updated = updateDocument(req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ error: 'Document not found.' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
