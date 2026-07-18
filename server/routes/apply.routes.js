import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDetails, saveDetails, rememberAnswer } from '../apply/answers/store.js';
import { loadQueue, enqueueReview, resolveReview, clearQueue } from '../apply/answers/reviewQueue.js';
import { gradeAnswer, gradeEvaluation } from '../apply/confidence.js';
import * as connections from '../apply/connections/manager.js';
import * as browser from '../apply/browser.js';
import { getBoard } from '../apply/boards/index.js';
import { autofillJob } from '../apply/autofill.js';
import { setSession, getSession } from '../apply/session.js';
import { loadProfile } from '../profile/store.js';
import { draftApplication } from '../apply/drafter.js';
import { reviewApplication } from '../apply/reviewer.js';
import { runAtsCheck } from '../apply/atsCheck.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { getDocument } from '../documents/store.js';
import { renderResumePdf } from '../documents/pdf/render.js';

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

  // --- Draft + Review + honest ATS pipeline (Phase 11, server-side) ---
  // Drafter tailors the CV/cover letter -> Reviewer checks for fabrication ->
  // honest ATS parse reports present/missing keywords. The USER decides what to
  // send; nothing is submitted automatically. Requires AI keys (desktop flow).
  router.post('/apply/draft', async (req, res) => {
    try {
      const jobText = (req.body?.jobText ?? '').trim();
      if (!jobText) return res.status(400).json({ error: 'Please paste a job description.' });

      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Complete the AI setup wizard before drafting applications.' });
      }

      const profile = await loadProfile(req.userId);
      const engine = createEngine(config);

      const draft = await draftApplication({ profile, jobText, engine });
      const review = await reviewApplication({ profile, jobText, draft, engine });
      const ats = runAtsCheck({ resumeMarkdown: draft.resumeMarkdown, jobText });

      res.json({ draft, review, ats });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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

  // --- Confidence-gated auto-apply: deterministic grading + review queue (flagship) ---
  // The confidence model grades every answer WITHOUT an LLM. These routes are
  // purely storage/compute — no browser, no Playwright — so they are cloud-safe.
  router.post('/apply/grade', (req, res) => {
    try {
      const { question, answerDraft, profile = {}, faq = [] } = req.body ?? {};
      res.json(gradeAnswer(question, answerDraft, profile, faq));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/apply/grade-evaluation', (req, res) => {
    try {
      const { answers = [], profile = {}, faq = [] } = req.body ?? {};
      res.json(gradeEvaluation(answers, profile, faq));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // "Needs review" queue — low-confidence answers that were NOT submitted.
  router.get('/apply/review-queue', async (req, res) => {
    try { res.json(await loadQueue(req.userId)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post('/apply/review-queue', async (req, res) => {
    try {
      const { entries = [], jobUrl = '' } = req.body ?? {};
      res.json(await enqueueReview(req.userId, entries, jobUrl));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/apply/review-queue/resolve', async (req, res) => {
    try {
      const { id, answer } = req.body ?? {};
      res.json(await resolveReview(req.userId, id, { answer }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/apply/review-queue/clear', async (req, res) => {
    try { res.json(await clearQueue(req.userId)); } catch (e) { res.status(400).json({ error: e.message }); }
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

      const config = await loadConfig(req.userId);
      const engine = config.setupComplete
        ? createEngine(config)
        : { generate: async () => { throw new Error('AI not configured'); } };
      const profile = await loadProfile(req.userId);
      const details = loadDetails();

      // Optional: attach a saved tailored document (cover letter + rendered resume PDF).
      const documents = {};
      if (documentId) {
        const doc = await getDocument(req.userId, documentId);
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

      // Confidence-gated: low-confidence answers are NOT submitted — they go to
      // the "Needs review" queue for the human to confirm/edit instead.
      const lowConfidence = result.pending.filter((p) => p.confidence === 'low' && p.draft);
      if (lowConfidence.length > 0) {
        await enqueueReview(req.userId, lowConfidence.map((p) => ({
          id: p.id,
          label: p.label,
          answer: p.draft,
          missingReference: p.missingReference ?? 'profile/FAQ',
        })), jobUrl);
      }
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

  // Email-Apply compose lives in apply-cloud.routes.js (cloud-safe, no browser).

  return router;
}
