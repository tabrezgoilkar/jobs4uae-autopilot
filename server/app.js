import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from './config/store.js';
import { createEngine } from './ai/index.js';
import { profileRouter } from './routes/profile.routes.js';
import { evaluateRouter } from './routes/evaluate.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { pdfRouter } from './routes/pdf.routes.js';
import { trackerRouter } from './routes/tracker.routes.js';
import { upskillRouter } from './routes/upskill.routes.js';
import { scannerRouter } from './routes/scanner.routes.js';
import { copilotRouter } from './routes/copilot.routes.js';
import { applyRouter } from './routes/apply.routes.js';
import { applyCloudRouter } from './routes/apply-cloud.routes.js';
import { authMiddleware, assertProdAuthConfig } from './auth/middleware.js';
import { clerkVerifier } from './auth/clerk.js';
import { installPageHtml } from './profile/linkedin/bookmarklet.js';

export function createApp() {
  assertProdAuthConfig();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Public, secret-free endpoints (no auth).
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/linkedin', (req, res) => {
    res.type('html').send(installPageHtml(`${req.protocol}://${req.get('host')}`));
  });

  // Everything below requires a signed-in user (cloud); local dev → userId 'local'.
  app.use('/api', authMiddleware({ verifyToken: clerkVerifier() }));

  // Config + AI-test are now behind the gate (they expose engine config / keys).
  // NOTE: config is still a single global record — per-user settings land in slice
  // A3 (hybrid AI / encrypted BYOK); until then it is at least non-anonymous.
  app.get('/api/config', async (req, res) => {
    try { res.json(await loadConfig(req.userId)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/config', async (req, res) => {
    try { res.json(await saveConfig(req.userId, req.body ?? {})); } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/ai/test', async (req, res) => {
    try {
      const engine = createEngine(req.body ?? {});
      res.json(await engine.testConnection());
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  });

  app.use('/api/profile', profileRouter());
  app.use('/api', evaluateRouter());
  app.use('/api', documentsRouter());
  app.use('/api', pdfRouter());
  app.use('/api', trackerRouter());
  app.use('/api', upskillRouter());
  app.use('/api', scannerRouter());
  app.use('/api', copilotRouter());
  app.use('/api', applyCloudRouter());
  app.use('/api', applyRouter());

  // In production, serve the built web app if it exists.
  const webDist = path.resolve(process.cwd(), 'web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}
