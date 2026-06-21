import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from './config/store.js';
import { createEngine } from './ai/index.js';
import { profileRouter } from './routes/profile.routes.js';
import { evaluateRouter } from './routes/evaluate.routes.js';
import { documentsRouter } from './routes/documents.routes.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

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

  app.use('/api/profile', profileRouter());
  app.use('/api', evaluateRouter());
  app.use('/api', documentsRouter());

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
