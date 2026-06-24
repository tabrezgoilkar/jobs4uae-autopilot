import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDetails, saveDetails, rememberAnswer } from '../apply/answers/store.js';
import * as connections from '../apply/connections/manager.js';
import * as browser from '../apply/browser.js';
import { getBoard } from '../apply/boards/index.js';
import { autofillJob } from '../apply/autofill.js';
import { setSession, getSession } from '../apply/session.js';
import { loadProfile } from '../profile/store.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { getDocument } from '../documents/store.js';
import { renderResumePdf } from '../documents/pdf/render.js';
import { extractEmails, mailtoLink, gmailComposeLink, composeApplicationEmail } from '../apply/email/compose.js';

// Assisted Auto-Apply (Phase 11). The app prepares and assists; the USER submits.
// There is deliberately no "submit" route.
export function applyRouter() {
  const router = Router();

  // --- Application Details (reusable GCC answers + accumulating memory) ---
  router.get('/application-details', (req, res) => {
    try { res.json(loadDetails()); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post('/application-details', (req, res) => {
    try { res.json(saveDetails(req.body ?? {})); } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // --- Connections (per-board session) ---
  router.get('/connections', (req, res) => {
    try { res.json(connections.getStatus()); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post('/connections/:board/connect', async (req, res) => {
    try { res.json(await connections.connect(req.params.board)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/connections/:board/confirm', async (req, res) => {
    try { res.json(await connections.confirm(req.params.board)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/connections/:board/disconnect', async (req, res) => {
    try { res.json(await connections.disconnect(req.params.board)); } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // --- Apply flow ---
  router.post('/apply/start', async (req, res) => {
    try {
      const { board: boardId, jobUrl, documentId } = req.body ?? {};
      const board = getBoard(boardId);
      if (!board) return res.status(400).json({ error: 'Unknown board.' });
      if (!jobUrl) return res.status(400).json({ error: 'A job URL is required.' });
      if (!connections.isConnected(boardId)) {
        return res.status(409).json({ error: `Connect ${board.name} first (Connections tab).` });
      }

      const config = loadConfig();
      const engine = config.setupComplete
        ? createEngine(config)
        : { generate: async () => { throw new Error('AI not configured'); } };
      const profile = loadProfile(req.userId);
      const details = loadDetails();

      // Optional: attach a saved tailored document (cover letter + rendered resume PDF).
      const documents = {};
      if (documentId) {
        const doc = getDocument(req.userId, documentId);
        if (doc) {
          documents.coverLetter = doc.coverLetterMarkdown ?? '';
          try {
            const pdf = await renderResumePdf(profile, doc.resumeMarkdown ?? '');
            const tmp = path.join(os.tmpdir(), `j4u-resume-${Date.now()}.pdf`);
            fs.writeFileSync(tmp, pdf);
            documents.resumePdfPath = tmp;
          } catch { /* proceed without the PDF attachment */ }
        }
      }

      const { adapter } = await browser.openJobPage(board, jobUrl);
      const result = await autofillJob(adapter, { board, profile, details, documents, job: jobUrl }, engine);
      setSession(boardId, { boardId, adapter, pending: result.pending });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/apply/answer', async (req, res) => {
    try {
      const { board: boardId, answers = [] } = req.body ?? {};
      const session = getSession(boardId);
      if (!session) return res.status(409).json({ error: 'No active application. Start one first.' });

      const byId = new Map(session.pending.map((p) => [p.id, p]));
      for (const { id, answer } of answers) {
        const item = byId.get(id);
        if (!item || !String(answer ?? '').trim()) continue;
        await session.adapter.fillField(item.selector, answer);
        rememberAnswer({ questionLabel: item.label, answer, source: 'user' });
        byId.delete(id);
      }
      session.pending = [...byId.values()];
      res.json({ remaining: session.pending });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Email-Apply (the "send your CV to hr@…" channel) ---
  router.post('/apply/email/compose', async (req, res) => {
    try {
      const { jobText = '', recruiterEmail, company } = req.body ?? {};
      const found = extractEmails(jobText);
      const to = String(recruiterEmail ?? '').trim() || found[0];
      if (!to) {
        return res.status(422).json({ error: 'No recruiter email found. Paste the post including the address, or enter it.' });
      }
      const config = loadConfig();
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before drafting emails.' });
      }
      const engine = createEngine(config);
      const { subject, body } = await composeApplicationEmail(loadProfile(req.userId), jobText, { email: to, company }, engine);
      res.json({ to, subject, body, mailto: mailtoLink({ to, subject, body }), gmail: gmailComposeLink({ to, subject, body }), foundEmails: found });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
