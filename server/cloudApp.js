import express from 'express';
import { loadConfig, saveConfig } from './config/store.js';
import { createEngine } from './ai/index.js';
import { profileRouter } from './routes/profile.routes.js';
import { installPageHtml } from './profile/linkedin/bookmarklet.js';
import { documentsRouter } from './routes/documents.routes.js';
import { copilotRouter } from './routes/copilot.routes.js';
import { applyCloudRouter } from './routes/apply-cloud.routes.js';
import { scannerRouter } from './routes/scanner.routes.js';
import { evaluateRouter } from './routes/evaluate.routes.js';
import { upskillRouter } from './routes/upskill.routes.js';
import { authMiddleware, assertProdAuthConfig } from './auth/middleware.js';
import { clerkVerifier } from './auth/clerk.js';

// The cloud (Vercel serverless) Express app. Mounts ONLY routers that are safe to
// bundle into a function and that use per-user stores — no Playwright (the
// indeed board + raw-link fetch belong to the desktop companion), and no global
// stores that would leak across tenants. The scanner here is restricted to
// `rest:true` boards (LinkedIn jobs-guest, FreeHire) that answer a plain
// server-side fetch. Static assets are served by Vercel, not here.
export function createCloudApp() {
  assertProdAuthConfig();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // The LinkedIn bookmarklet install page. Served under /api/* because Vercel only
  // routes /api/* to this function (everything else is the SPA), and public (no
  // auth) so the draggable button page loads. The bookmarklet POSTs back to this
  // same origin; on the cloud that cross-origin call isn't authed, so it falls back
  // to downloading a linkedin-profile.json the user uploads in Import from LinkedIn.
  const originOf = (req) => `https://${req.get('host')}`;
  app.get('/api/linkedin-install', (req, res) => res.type('html').send(installPageHtml(originOf(req))));

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
  app.use('/api', copilotRouter()); // reads per-user profile; evaluations context is best-effort
  app.use('/api', applyCloudRouter());
  // Cloud-safe, no-browser features:
  app.use('/api', scannerRouter({ cloud: true })); // only rest:true boards (LinkedIn, FreeHire)
  app.use('/api', evaluateRouter()); // /evaluate/fit is pure/no-AI; /evaluate needs AI setup
  app.use('/api', upskillRouter()); // read-only join of tracker + evaluations

  return app;
}
