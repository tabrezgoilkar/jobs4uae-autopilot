import { extractJson } from '../lib/json.js';

const DRAFT_SYSTEM = `You are a careful career-coach assistant that TAILORS a candidate's resume and cover letter to a job posting.
RULES — these are non-negotiable:
- Use ONLY skills, titles, companies, and metrics that appear in the candidate profile. NEVER invent experience, jobs, degrees, or numbers.
- If the job wants something the candidate lacks, do NOT fabricate it. Instead, emphasize adjacent strengths or omit that requirement.
- Keep the resume truthful and ATS-friendly (standard section headings, no tables/images).
- Return STRICT JSON: {"resumeMarkdown": string, "coverLetterMarkdown": string, "rationale": string}.`;

function buildDraftPrompt(profile, jobText) {
  return `CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

JOB POSTING:
${jobText}

Tailor the resume + cover letter to this posting. Output strict JSON only.`;
}

/**
 * @returns {Promise<{resumeMarkdown:string, coverLetterMarkdown:string, rationale:string}>}
 */
export async function draftApplication({ profile, jobText, engine }) {
  const text = await engine.generate({
    system: DRAFT_SYSTEM,
    prompt: buildDraftPrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    throw new Error(`Drafter returned no usable JSON. ${e.message}`);
  }
  return {
    resumeMarkdown: String(parsed.resumeMarkdown ?? ''),
    coverLetterMarkdown: String(parsed.coverLetterMarkdown ?? ''),
    rationale: String(parsed.rationale ?? ''),
  };
}
