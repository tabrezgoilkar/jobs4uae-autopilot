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
import { scannerRouter } from './routes/scanner.routes.js';
import { copilotRouter } from './routes/copilot.routes.js';
import { applyRouter } from './routes/apply.routes.js';
import { authMiddleware } from './auth/middleware.js';
import { clerkVerifier } from './auth/clerk.js';
import { installPageHtml } from './profile/linkedin/bookmarklet.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Standalone page with the drag-to-bookmarks LinkedIn importer.
  app.get('/linkedin', (req, res) => {
    res.type('html').send(installPageHtml(`${req.protocol}://${req.get('host')}`));
  });

  app.get('/api/config', (req, res) => {
    res.json(loadConfig());
  });

  app.post('/api/config', (req, res) => {
    res.json(saveConfig(req.body ?? {}));
  });

  app.post('/api/ai/test', async (req, res) => {
    try {
      const engine = createEngine(req.body ?? {});
      res.json(await engine.testConnection());
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  });

  // Everything below requires a signed-in user (cloud); local dev → userId 'local'.
  // Mounted after the public health/config/ai-test endpoints above.
  app.use('/api', authMiddleware({ verifyToken: clerkVerifier() }));

  app.use('/api/profile', profileRouter());
  app.use('/api', evaluateRouter());
  app.use('/api', documentsRouter());
  app.use('/api', pdfRouter());
  app.use('/api', trackerRouter());
  app.use('/api', scannerRouter());
  app.use('/api', copilotRouter());
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
