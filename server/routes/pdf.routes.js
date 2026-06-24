import { Router } from 'express';
import { getDocument } from '../documents/store.js';
import { loadProfile } from '../profile/store.js';
import { renderResumePdf, renderCoverLetterPdf } from '../documents/pdf/render.js';

const VALID_KINDS = new Set(['resume', 'cover']);

export function pdfRouter() {
  const router = Router();

  router.post('/documents/:id/pdf', async (req, res) => {
    try {
      const kind = (req.query.kind ?? 'resume').toString();

      if (!VALID_KINDS.has(kind)) {
        return res.status(400).json({ error: `Invalid kind "${kind}". Use "resume" or "cover".` });
      }

      const doc = await getDocument(req.userId, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const profile = await loadProfile(req.userId);

      let pdfBuffer;
      let filename;

      if (kind === 'resume') {
        pdfBuffer = await renderResumePdf(profile, doc.resumeMarkdown ?? '');
        filename = `resume-${req.params.id}.pdf`;
      } else {
        pdfBuffer = await renderCoverLetterPdf(profile, doc.coverLetterMarkdown ?? '');
        filename = `cover-letter-${req.params.id}.pdf`;
      }

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
