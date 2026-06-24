import express from 'express';
import { loadConfig, saveConfig } from './config/store.js';
import { createEngine } from './ai/index.js';
import { profileRouter } from './routes/profile.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { applyCloudRouter } from './routes/apply-cloud.routes.js';
import { authMiddleware, assertProdAuthConfig } from './auth/middleware.js';
import { clerkVerifier } from './auth/clerk.js';

// The cloud (Vercel serverless) Express app. Mounts ONLY routers that are safe to
// bundle into a function and that use per-user stores — no Playwright (Scan /
// Assisted-Apply belong to the Phase B desktop companion), and no global stores
// that would leak across tenants. Static assets are served by Vercel, not here.
export function createCloudApp() {
  assertProdAuthConfig();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', authMiddleware({ verifyToken: clerkVerifier() }));

  app.get('/api/config', async (req, res) => {
    try { res.json(await loadConfig(req.userId)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/config', async (req, res) => {
    try { res.json(await saveConfig(req.userId, req.body ?? {})); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/ai/test', async (req, res) => {
    try {
      res.json(await createEngine(req.body ?? {}).testConnection());
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  });

  app.use('/api/profile', profileRouter());
  app.use('/api', documentsRouter());
  app.use('/api', applyCloudRouter());

  return app;
}
