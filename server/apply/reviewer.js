import { extractJson } from '../lib/json.js';

const REVIEW_SYSTEM = `You are a strict honesty reviewer for a job application draft.
Compare the DRAFTED resume/cover letter against the CANDIDATE PROFILE and the JOB POSTING.
Your ONLY job is to catch fabrication and mismatch:
- Skills/experience/titles/companies/metrics in the draft that are NOT in the candidate profile = FABRICATION (serious).
- Claims that contradict the profile (wrong years, wrong company) = MISMATCH.
- Required job keywords the draft does not address = GAP (informational, not dishonest).
Return STRICT JSON: {
  "honestyScore": number (0-100, 100 = fully truthful),
  "approved": boolean (true only if honestyScore >= 85 AND no fabrication issues),
  "issues": string[]  // human-readable findings; fabrication first
}`;

function buildReviewPrompt(profile, jobText, draft) {
  return `CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

JOB POSTING:
${jobText}

DRAFTED RESUME:
${draft.resumeMarkdown}

DRAFTED COVER LETTER:
${draft.coverLetterMarkdown}

Review for fabrication and mismatch. Output strict JSON only.`;
}

/**
 * @returns {Promise<{honestyScore:number, approved:boolean, issues:string[]}>}
 */
export async function reviewApplication({ profile, jobText, draft, engine }) {
  const text = await engine.generate({
    system: REVIEW_SYSTEM,
    prompt: buildReviewPrompt(profile, jobText, draft),
  });
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    // If the reviewer itself fails, fail safe: do NOT auto-approve.
    return { honestyScore: 0, approved: false, issues: [`Reviewer returned no usable JSON: ${e.message}`] };
  }
  const honestyScore = Math.max(0, Math.min(100, Number(parsed.honestyScore ?? 0)));
  const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String) : [];
  const approved = Boolean(parsed.approved) && honestyScore >= 85 && !issues.some((i) => /fabricat/i.test(i));
  return { honestyScore, approved, issues };
}
