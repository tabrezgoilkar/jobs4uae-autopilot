import { Router } from 'express';
import { loadProfile } from '../profile/store.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { extractEmails, mailtoLink, gmailComposeLink, composeApplicationEmail } from '../apply/email/compose.js';
import { draftApplication } from '../apply/drafter.js';
import { reviewApplication } from '../apply/reviewer.js';
import { runAtsCheck } from '../apply/atsCheck.js';

// Cloud-safe Assisted-Apply endpoint: Email-Apply compose + the Draft/Review/ATS
// pipeline. Imports NO browser/Playwright code, so it bundles into a Vercel
// serverless function, and reads only the per-user profile. The headed-browser
// autofill endpoints live in apply.routes.js (companion only).
export function applyCloudRouter() {
  const router = Router();

  router.post('/apply/email/compose', async (req, res) => {
    try {
      const { jobText = '', recruiterEmail, company } = req.body ?? {};
      const found = extractEmails(jobText);
      const to = String(recruiterEmail ?? '').trim() || found[0];
      if (!to) {
        return res.status(422).json({ error: 'No recruiter email found. Paste the post including the address, or enter it.' });
      }
      const config = await loadConfig(req.userId);
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before drafting emails.' });
      }
      const engine = createEngine(config);
      const { subject, body } = await composeApplicationEmail(await loadProfile(req.userId), jobText, { email: to, company }, engine);
      res.json({ to, subject, body, mailto: mailtoLink({ to, subject, body }), gmail: gmailComposeLink({ to, subject, body }), foundEmails: found });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Drafter -> Reviewer -> honest ATS. Pure AI (no browser), so cloud-safe.
  // The USER decides what to send; nothing is submitted automatically.
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

  return router;
}
