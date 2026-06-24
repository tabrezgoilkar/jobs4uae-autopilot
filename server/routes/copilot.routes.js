import { Router } from 'express';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { loadProfile } from '../profile/store.js';
import { listEvaluations } from '../evaluate/store.js';
import { askCopilot } from '../copilot/engine.js';

export function copilotRouter() {
  const router = Router();

  router.post('/copilot', async (req, res) => {
    try {
      const question = (req.body?.question ?? '').toString().trim();
      if (!question) return res.status(400).json({ error: 'Please enter a question.' });

      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before using the copilot.' });
      }

      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const engine = createEngine(config);
      const profile = await loadProfile(req.userId);
      let evaluations = [];
      try {
        evaluations = listEvaluations();
      } catch {
        // context is best-effort; never fail the answer over it
      }

      const result = await askCopilot({ profile, evaluations, question, history }, engine);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
