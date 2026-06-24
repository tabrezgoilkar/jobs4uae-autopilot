export const DOC_SYSTEM =
  'You are an elite career coach and resume writer for the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). ' +
  'Your job is to take a talented person who may be poor at self-presentation and turn their real experience into a ' +
  'sharp, employer-ready application FOR THIS SPECIFIC ROLE. You think first (what does this job reward? what are this ' +
  "candidate's strongest matching proofs? what's their biggest gap and how do we honestly soften it?), then you reshape, " +
  'reorder, and rewrite — foregrounding the most relevant evidence, leading bullets with impact, and mirroring the job\'s ' +
  'language. This is real tailoring, NOT a light re-word of the same CV. You NEVER invent employers, titles, dates, ' +
  'metrics, qualifications, or skills. You write clean, ATS-friendly Markdown. Return ONLY the five marked sections requested — no preamble, no JSON, no code fences.';

export function buildDocumentsPrompt(profile, jobText) {
  return `Coach this candidate into the strongest HONEST application for the job below, and explain your reasoning.

Think like a career coach: identify what this role rewards, pick the candidate's most relevant real proofs, lead with them, mirror the job's keywords, and address the weakest area without inventing anything.

1) resumeMarkdown — a tailored, ATS-friendly resume in clean Markdown with EXACTLY this structure:

# {Full name}
**{Professional headline reframed toward this role}**
{email · phone · location · any links — one line}

## Summary
2–3 sentences positioning the candidate for THIS role, leading with the most relevant strength.

## Core skills
The most job-relevant skills first (prioritise overlaps between the profile and the job). Comma-separated or short bullets.

## Experience
Most recent first. For each role:
### {Title} — {Company}
*{start} – {end}*
- 3–5 achievement bullets. Lead with impact/results, quantify ONLY where the profile already gives numbers, and rewrite each bullet to emphasise what THIS job values. Never fabricate metrics or responsibilities.

## Education
- {Degree}, {Field} — {Institution} ({year})

Add ## Projects / ## Certifications / ## Languages / ## Awards ONLY if the profile contains them.

Markdown rules: real headings and "- " bullets, blank line between sections, NO code fences, NO JSON inside the markdown.

2) coverLetterMarkdown — 3–4 short, specific paragraphs in Markdown addressed to the role/company; concrete, not generic.

3) fitScore — after tailoring, grade the fit A–F (A = excellent).

4) missingSkills — important skills the JOB requires that are still genuinely MISSING from the candidate (do not list skills they have; do not invent).

5) rationale — 2–4 sentences of COACHING: the key tailoring decisions you made and WHY (which strengths you led with for this role, what language you mirrored, and which gap you addressed and how) — honest, specific to this candidate and job, no fabrication.

Return EXACTLY these five sections and NOTHING else — no preamble, no JSON, no code fences. Each section starts with its marker alone on its own line:

===FIT===
A single grade letter (A, B, C, D, or F) — the fit AFTER tailoring.
===MISSING===
Comma-separated skills the JOB needs that the candidate still genuinely lacks (leave this line blank if none).
===RATIONALE===
The 2–4 sentences of coaching described above.
===RESUME===
The full tailored resume in Markdown, using the structure described above.
===COVER===
The full cover letter in Markdown.

(Put the resume and cover letter Markdown directly under their markers — write freely, no escaping needed.)

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
