import { DOC_SYSTEM, buildDocumentsPrompt } from './prompt.js';
import { coerceGrade } from '../lib/grades.js';

// The AI returns sentinel-delimited sections rather than JSON, because the resume
// and cover letter are large freeform Markdown — embedding them in JSON routinely
// breaks parsing (unescaped quotes/newlines inside the string values). Sentinels
// are robust to any content.
function parseSections(text) {
  const out = {};
  const re = /===\s*([A-Z]+)\s*===/g;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ name: m[1], headerStart: m.index, contentStart: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].headerStart : text.length;
    out[marks[i].name] = text.slice(marks[i].contentStart, end).trim();
  }
  return out;
}

function normalizeDocuments(s) {
  return {
    resumeMarkdown: s.RESUME ?? '',
    coverLetterMarkdown: s.COVER ?? '',
    fitScore: coerceGrade(s.FIT),
    missingSkills: s.MISSING ? s.MISSING.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean) : [],
    rationale: s.RATIONALE ?? '',
  };
}

export async function generateDocuments(profile, jobText, engine) {
  const raw = await engine.generate({
    system: DOC_SYSTEM,
    prompt: buildDocumentsPrompt(profile, jobText),
  });
  const docs = normalizeDocuments(parseSections(String(raw ?? '')));
  if (!docs.resumeMarkdown && !docs.coverLetterMarkdown) {
    throw new Error('The AI did not return any document content. Please try again.');
  }
  return docs;
}
