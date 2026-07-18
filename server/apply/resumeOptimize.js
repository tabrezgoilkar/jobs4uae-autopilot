// Resume optimization suggestions — the CrewAI "optimize_resume_task" idea,
// ported to our honest, fabrication-free pipeline. Given a candidate profile +
// a job posting, an LLM returns structured before/after rewrites per section,
// skills to highlight, and ATS keywords to add. Reuses the same engine/key
// plumbing as the drafter so it's cloud-safe (BYOK / Ollama / Gemini).
//
// We deliberately keep the drafter's honesty rules: never invent experience,
// jobs, degrees, or numbers. The model may only rephrase/emphasize what is
// already present in the profile.

import { extractJson } from '../lib/json.js';

const OPTIMIZE_SYSTEM = `You are a resume optimization specialist. You review a candidate's profile against a job posting and propose concrete, ATS-friendly improvements.

RULES — non-negotiable:
- Use ONLY skills, titles, companies, metrics, and achievements that already appear in the candidate profile. NEVER invent experience, jobs, degrees, certifications, or numbers.
- If the job wants something the candidate lacks, do NOT fabricate it. Instead suggest emphasizing an adjacent strength, or omit that requirement.
- Keep every suggestion truthful and ATS-parseable (standard section headings, plain bullet lists, no tables/images).
- Return STRICT JSON matching this shape:
{
  "content_suggestions": [ { "section": string, "before": string, "after": string, "rationale": string } ],
  "skills_to_highlight": string[],
  "achievements_to_add": string[],
  "keywords_for_ats": string[],
  "formatting_suggestions": string[]
}`;

function buildOptimizePrompt(profile, jobText) {
  return `CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

JOB POSTING:
${jobText}

Propose concrete improvements. Output strict JSON only — no prose, no markdown fences.`;
}

/**
 * @returns {Promise<{
 *   content_suggestions: {section:string, before:string, after:string, rationale:string}[],
 *   skills_to_highlight: string[],
 *   achievements_to_add: string[],
 *   keywords_for_ats: string[],
 *   formatting_suggestions: string[],
 * }>}
 */
export async function optimizeResume({ profile, jobText, engine }) {
  const text = await engine.generate({
    system: OPTIMIZE_SYSTEM,
    prompt: buildOptimizePrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    throw new Error(`Optimizer returned no usable JSON. ${e.message}`);
  }
  return {
    content_suggestions: Array.isArray(parsed.content_suggestions) ? parsed.content_suggestions : [],
    skills_to_highlight: Array.isArray(parsed.skills_to_highlight) ? parsed.skills_to_highlight : [],
    achievements_to_add: Array.isArray(parsed.achievements_to_add) ? parsed.achievements_to_add : [],
    keywords_for_ats: Array.isArray(parsed.keywords_for_ats) ? parsed.keywords_for_ats : [],
    formatting_suggestions: Array.isArray(parsed.formatting_suggestions) ? parsed.formatting_suggestions : [],
  };
}
