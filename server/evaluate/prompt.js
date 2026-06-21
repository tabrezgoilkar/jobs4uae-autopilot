export const EVAL_SYSTEM =
  'You are a careful job-fit evaluator for candidates job-hunting in the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). Return ONLY valid JSON, no commentary.';

export const DIMENSIONS = [
  'Skills match',
  'Experience level',
  'Industry / domain fit',
  'Seniority match',
  'Location / relocation fit (GCC)',
  'Growth potential',
];

export function buildEvaluationPrompt(profile, jobText) {
  return `Evaluate how well this candidate fits the job below. Be honest and specific; do not invent facts.

Grade the OVERALL fit and EACH dimension on an A–F scale (A = excellent fit, F = poor fit).
Recommendation must be one of: "apply", "maybe", "skip".

Score these dimensions (use exactly these names): ${DIMENSIONS.map((d) => `"${d}"`).join(', ')}.

Return JSON with EXACTLY these keys:
{
  "jobTitle": string,
  "company": string,
  "location": string,
  "grade": "A" | "B" | "C" | "D" | "F",
  "recommendation": "apply" | "maybe" | "skip",
  "summary": string,                 // 2-4 sentences in plain language
  "dimensions": [ { "name": string, "score": "A"|"B"|"C"|"D"|"F", "comment": string } ],
  "matchedSkills": string[],         // candidate skills relevant to this job
  "missingSkills": string[]          // important skills the job wants that the candidate lacks
}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
