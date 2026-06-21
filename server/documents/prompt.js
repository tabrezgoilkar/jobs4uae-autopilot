export const DOC_SYSTEM =
  'You are an expert resume writer for candidates job-hunting in the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). You write clear, ATS-friendly resumes and cover letters in Markdown. Return ONLY valid JSON, no commentary.';

export function buildDocumentsPrompt(profile, jobText) {
  return `Using the candidate profile and the job description, write two documents AND assess fit.

1. A tailored, ATS-friendly RESUME in Markdown: concise, achievement-focused, naturally incorporating keywords from the job description. Reshape and emphasize ONLY what the profile already contains — do NOT invent experience, employers, dates, or qualifications.
2. A tailored COVER LETTER in Markdown: professional and specific to this role/company, 3-4 short paragraphs.
3. After tailoring, assess how well this tailored application fits the job: give an overall fit grade from A to F (A = excellent fit, F = poor fit), and list the important skills the job requires that are still MISSING from the candidate. Do NOT list skills the candidate already has, and do NOT invent skills.

Return JSON with EXACTLY these keys:
{
  "resumeMarkdown": string,
  "coverLetterMarkdown": string,
  "fitScore": "A" | "B" | "C" | "D" | "F",
  "missingSkills": string[]
}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
