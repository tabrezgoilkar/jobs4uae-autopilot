import { Router } from 'express';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { loadProfile } from '../profile/store.js';
import { evaluateJob } from '../evaluate/engine.js';
import { scoreFit } from '../evaluate/scoreFit.js';
import { addEvaluation, listEvaluations, getEvaluation } from '../evaluate/store.js';

export function evaluateRouter() {
  const router = Router();

  router.post('/evaluate', async (req, res) => {
    try {
      const jobText = (req.body?.jobText ?? '').trim();
      if (!jobText) return res.status(400).json({ error: 'Please paste a job description.' });

      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before evaluating jobs.' });
      }

      const engine = createEngine(config);
      const profile = await loadProfile(req.userId);
      const result = await evaluateJob(profile, jobText, engine);
      const saved = addEvaluation({ ...result, jobText });
      res.json(saved);
    } catch (e) {
      // Input errors return 400 above; anything reaching here is a server/AI failure.
      res.status(500).json({ error: e.message });
    }
  });

  // Instant, deterministic fit score (no AI setup required). Complements the
  // AI evaluation: transparent 5-dimension breakdown every user can see on paste.
  router.post('/evaluate/fit', async (req, res) => {
    try {
      const jobText = (req.body?.jobText ?? '').trim();
      if (!jobText) return res.status(400).json({ error: 'Please paste a job description.' });
      const profile = await loadProfile(req.userId);
      res.json(scoreFit({ jobText, profile }));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/evaluations', (req, res) => {
    try {
      res.json(listEvaluations());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/evaluations/:id', (req, res) => {
    try {
      const found = getEvaluation(req.params.id);
      if (!found) return res.status(404).json({ error: 'Evaluation not found.' });
      res.json(found);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
