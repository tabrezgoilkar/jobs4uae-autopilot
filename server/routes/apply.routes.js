import { Router } from 'express';
import { loadDetails, saveDetails } from '../apply/answers/store.js';

// Assisted Auto-Apply (Phase 11). v1 surface: Application Details (the reusable
// GCC answers + accumulating Q&A memory). Connections + apply flow are added in
// later slices. There is deliberately no "submit" route — the user submits.
export function applyRouter() {
  const router = Router();

  router.get('/application-details', (req, res) => {
    try {
      res.json(loadDetails());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/application-details', (req, res) => {
    try {
      res.json(saveDetails(req.body ?? {}));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
