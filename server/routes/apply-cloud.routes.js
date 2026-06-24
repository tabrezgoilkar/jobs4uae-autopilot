import { Router } from 'express';
import { loadProfile } from '../profile/store.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { extractEmails, mailtoLink, gmailComposeLink, composeApplicationEmail } from '../apply/email/compose.js';

// Cloud-safe Assisted-Apply endpoint: Email-Apply compose. Imports NO browser/
// Playwright code, so it bundles into a Vercel serverless function, and reads only
// the per-user profile (no global stores that would leak across tenants). The
// headed-browser endpoints + the (not-yet-per-user) Application Details live in
// apply.routes.js and run only in the full local/companion app.
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
