import { Router } from 'express';
import { BOARDS, scan } from '../scanner/engine.js';

export function scannerRouter() {
  const router = Router();

  /**
   * GET /api/scanner/boards
   * Returns list of supported boards [{id, name}]
   */
  router.get('/scanner/boards', (req, res) => {
    res.json(BOARDS.map(({ id, name }) => ({ id, name })));
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

  return router;
}
