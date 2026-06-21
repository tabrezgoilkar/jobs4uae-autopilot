export const DOC_SYSTEM =
  'You are an expert resume writer for candidates job-hunting in the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). You write clear, ATS-friendly resumes and cover letters in Markdown. Return ONLY valid JSON, no commentary.';

export function buildDocumentsPrompt(profile, jobText) {
  return `Using the candidate profile and the job description, write two documents.

1. A tailored, ATS-friendly RESUME in Markdown: concise, achievement-focused, naturally incorporating keywords from the job description. Reshape and emphasize ONLY what the profile already contains — do NOT invent experience, employers, dates, or qualifications.
2. A tailored COVER LETTER in Markdown: professional and specific to this role/company, 3-4 short paragraphs.

Return JSON with EXACTLY these keys:
{
  "resumeMarkdown": string,
  "coverLetterMarkdown": string
}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
