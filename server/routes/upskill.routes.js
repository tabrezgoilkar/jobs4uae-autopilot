import { Router } from 'express';
import { listApplications } from '../tracker/store.js';
import { listEvaluations, getEvaluation } from '../evaluate/store.js';
import { buildUpskillHeatmap } from '../upskill/heatmap.js';
import { scoreFit } from '../evaluate/scoreFit.js';
import { loadProfile } from '../profile/store.js';

// GET /api/upskill/heatmap
// Joins tracked applications to their evaluations and returns a prioritized
// "skills to learn" heatmap (demand x fit-cost). Resilient to missing evals;
// when a stored evaluation has its original jobText we recompute the
// deterministic 0-100 fit to weight the cost accurately.
export function upskillRouter() {
  const router = Router();

  router.get('/upskill/heatmap', async (req, res) => {
    try {
      const apps = await listApplications(req.userId);
      const evalsById = new Map((await listEvaluations(req.userId)).map((e) => [e.id, e]));
      let profile;
      try { profile = loadProfile(req.userId); } catch { profile = {}; }

      const rows = apps.map((app) => {
        const ev = app.evaluationId ? evalsById.get(app.evaluationId) : null;
        let fitScore;
        if (ev?.jobText) fitScore = scoreFit({ jobText: ev.jobText, profile }).score;
        return {
          jobTitle: app.jobTitle || ev?.jobTitle || 'Untitled role',
          missingSkills: ev?.missingSkills || [],
          fitScore,
        };
      });

      res.json(buildUpskillHeatmap(rows));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
