import { extractJson } from '../lib/json.js';
import { EVAL_SYSTEM, buildEvaluationPrompt } from './prompt.js';

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const RECS = ['apply', 'maybe', 'skip'];

function coerceGrade(g) {
  const up = String(g || '').trim().toUpperCase();
  return GRADES.includes(up) ? up : 'C';
}

function normalizeEvaluation(raw = {}) {
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.map((d) => ({
        name: String(d?.name ?? ''),
        score: coerceGrade(d?.score),
        comment: String(d?.comment ?? ''),
      }))
    : [];
  return {
    jobTitle: String(raw.jobTitle ?? ''),
    company: String(raw.company ?? ''),
    location: String(raw.location ?? ''),
    grade: coerceGrade(raw.grade),
    recommendation: RECS.includes(raw.recommendation) ? raw.recommendation : 'maybe',
    summary: String(raw.summary ?? ''),
    dimensions,
    matchedSkills: Array.isArray(raw.matchedSkills) ? raw.matchedSkills.map(String) : [],
    missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills.map(String) : [],
  };
}

export async function evaluateJob(profile, jobText, engine) {
  const raw = await engine.generate({
    system: EVAL_SYSTEM,
    prompt: buildEvaluationPrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while evaluating this job. ${e.message}`);
  }
  return normalizeEvaluation(parsed);
}
