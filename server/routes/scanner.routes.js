import { Router } from 'express';
import { BOARDS, scan } from '../scanner/engine.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { estimateSalary } from '../scanner/salary.js';

export function scannerRouter() {
  const router = Router();

  /**
   * GET /api/scanner/boards
   * Returns list of supported boards [{id, name}]
   */
  router.get('/scanner/boards', (req, res) => {
    res.json(BOARDS.map(({ id, name, status }) => ({ id, name, status: status ?? 'experimental' })));
  });

  /**
   * POST /api/scanner/scan
   * Body: { board, keyword, country?, city? }
   * Returns: { listings, error? }
   */
  router.post('/scanner/scan', async (req, res) => {
    try {
      const { board, keyword, country, city } = req.body ?? {};

      if (!keyword || !String(keyword).trim()) {
        return res.status(400).json({ error: 'Please enter a keyword to search for.' });
      }

      const knownBoard = BOARDS.find((b) => b.id === board);
      if (!board || !knownBoard) {
        return res.status(400).json({ error: `Unknown board. Valid options: ${BOARDS.map((b) => b.id).join(', ')}.` });
      }

      const result = await scan({ board, keyword: String(keyword).trim(), country, city });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/scanner/salary
   * Body: { title, country?, city? } → AI-estimated GCC salary range (clearly an estimate).
   */
  router.post('/scanner/salary', async (req, res) => {
    try {
      const { title, country, city } = req.body ?? {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Missing job title.' });
      }
      const config = loadConfig();
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard first.' });
      }
      const engine = createEngine(config);
      const result = await estimateSalary({ title: String(title).trim(), country, city }, engine);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
