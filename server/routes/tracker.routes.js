import { Router } from 'express';
import {
  STATUSES,
  listApplications,
  addApplication,
  getApplication,
  updateApplication,
  deleteApplication,
} from '../tracker/store.js';

export function trackerRouter() {
  const router = Router();

  router.get('/applications', async (req, res) => {
    try {
      res.json(await listApplications(req.userId));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/applications', async (req, res) => {
    try {
      const { jobTitle, company, location, status, notes, evaluationId, documentId } = req.body ?? {};
      if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(', ')}.` });
      }
      const record = await addApplication(req.userId, { jobTitle, company, location, status, notes, evaluationId, documentId });
      res.json(record);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/applications/:id', async (req, res) => {
    try {
      const found = await getApplication(req.userId, req.params.id);
      if (!found) return res.status(404).json({ error: 'Application not found.' });
      res.json(found);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/applications/:id', async (req, res) => {
    try {
      const { status } = req.body ?? {};
      if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(', ')}.` });
      }
      const updated = await updateApplication(req.userId, req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ error: 'Application not found.' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/applications/:id/delete', async (req, res) => {
    try {
      const deleted = await deleteApplication(req.userId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Application not found.' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
