import { renderPdfFromHtml } from '../../lib/browser.js';
import { resumeHtml, coverLetterHtml } from './template.js';

/**
 * Render a resume PDF buffer from a profile and markdown string.
 * @param {object} profile
 * @param {string} resumeMarkdown
 * @returns {Promise<Buffer>}
 */
export async function renderResumePdf(profile, resumeMarkdown) {
  const html = resumeHtml(profile, resumeMarkdown);
  return renderPdfFromHtml(html);
}

/**
 * Render a cover letter PDF buffer from a profile and markdown string.
 * @param {object} profile
 * @param {string} coverLetterMarkdown
 * @returns {Promise<Buffer>}
 */
export async function renderCoverLetterPdf(profile, coverLetterMarkdown) {
  const html = coverLetterHtml(profile, coverLetterMarkdown);
  return renderPdfFromHtml(html);
}
