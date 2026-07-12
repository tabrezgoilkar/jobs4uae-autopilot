import { PdfDoc } from '../lib/pdfWriter.js';
import { profileToCvSections } from './cvSections.js';

/**
 * Render a profile to a real, selectable-text PDF buffer — no browser engine.
 * Cloud-safe (Node built-ins only). Returns a Buffer.
 * @param {object} profile
 * @returns {Buffer}
 */
export function renderProfileCvPdf(profile) {
  const cv = profileToCvSections(profile);
  const doc = new PdfDoc();

  // Header
  doc.text(cv.name, { size: 20, bold: true, gap: 1 });
  if (cv.headline) doc.text(cv.headline, { size: 11, color: [0.10, 0.24, 0.43], gap: 1 });
  if (cv.contact) doc.text(cv.contact, { size: 9, color: [0.26, 0.26, 0.26], gap: 2 });
  doc.rule();

  for (const sec of cv.sections) {
    doc.heading(sec.title);
    for (const item of sec.items) {
      if (item.heading) doc.text(item.heading, { size: 10.5, bold: true, gap: 1 });
      if (item.sub) doc.text(item.sub, { size: 9, color: [0.35, 0.35, 0.35], indent: 0, gap: 1 });
      if (item.body) doc.text(item.body, { size: 9.5, gap: 2 });
      if (item.bullets?.length) {
        for (const b of item.bullets) {
          doc.bullet(b, { size: 9.5, indent: 10, gap: 1 });
        }
      }
      doc.space(3);
    }
  }

  return doc.toBuffer();
}
