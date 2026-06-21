import { extractJson } from '../lib/json.js';
import { DOC_SYSTEM, buildDocumentsPrompt } from './prompt.js';

const GRADES = ['A', 'B', 'C', 'D', 'F'];

function coerceGrade(g) {
  const up = String(g || '').trim().toUpperCase();
  return GRADES.includes(up) ? up : 'C';
}

function normalizeDocuments(raw = {}) {
  return {
    resumeMarkdown: typeof raw.resumeMarkdown === 'string' ? raw.resumeMarkdown : '',
    coverLetterMarkdown: typeof raw.coverLetterMarkdown === 'string' ? raw.coverLetterMarkdown : '',
    fitScore: coerceGrade(raw.fitScore),
    missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills.map(String) : [],
  };
}

export async function generateDocuments(profile, jobText, engine) {
  const raw = await engine.generate({
    system: DOC_SYSTEM,
    prompt: buildDocumentsPrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while writing your documents. ${e.message}`);
  }
  const docs = normalizeDocuments(parsed);
  if (!docs.resumeMarkdown && !docs.coverLetterMarkdown) {
    throw new Error('The AI did not return any document content. Please try again.');
  }
  return docs;
}
