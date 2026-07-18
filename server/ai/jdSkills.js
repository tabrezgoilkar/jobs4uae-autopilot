// AI-based job-description skill extractor.
//
// Reuses the 5-category classification schema popularised by open-source
// LinkedIn auto-apply tools (tech_stack / technical_skills / other_skills /
// required_skills / nice_to_have). Given a job description, it returns the
// skills grouped so the scanner can match REQUIRED skills against the user's
// profile (better "why it fits" + ATS scoring).
//
// Cloud-safe: server-side only, uses the existing engine factory. No browser.

const EXTRACT_SKILLS_PROMPT = `You are a job requirements extractor and classifier. Your task is to extract all skills mentioned in a job description and classify them into five categories:
1. "tech_stack": programming languages, frameworks, libraries, databases, and other technologies.
2. "technical_skills": technical expertise beyond specific tools (architecture, system design, etc.).
3. "other_skills": non-technical skills (communication, leadership, teamwork).
4. "required_skills": skills specifically listed as required or expected.
5. "nice_to_have": skills listed as preferred or beneficial but not mandatory.
Return ONLY valid JSON (no commentary) in this exact shape:
{
  "tech_stack": [],
  "technical_skills": [],
  "other_skills": [],
  "required_skills": [],
  "nice_to_have": []
}
Each category is an array of strings, possibly empty.

JOB DESCRIPTION:
`;

export const EMPTY_JD_SKILLS = {
  tech_stack: [],
  technical_skills: [],
  other_skills: [],
  required_skills: [],
  nice_to_have: [],
};

function asStringArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  return [];
}

export async function extractJdSkills(jobDescription = '', engine = null) {
  const jd = String(jobDescription || '').trim();
  if (!jd) return { ...EMPTY_JD_SKILLS };
  if (!engine || typeof engine.generate !== 'function') return { ...EMPTY_JD_SKILLS };

  try {
    const raw = await engine.generate({
      system: 'You extract and classify skills from job descriptions. Return only JSON.',
      prompt: EXTRACT_SKILLS_PROMPT + jd,
    });
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      tech_stack: asStringArray(parsed?.tech_stack),
      technical_skills: asStringArray(parsed?.technical_skills),
      other_skills: asStringArray(parsed?.other_skills),
      required_skills: asStringArray(parsed?.required_skills),
      nice_to_have: asStringArray(parsed?.nice_to_have),
    };
  } catch {
    return { ...EMPTY_JD_SKILLS };
  }
}

// Flat list of all extracted skills (for quick profile matching).
export function flattenJdSkills(jdSkills) {
  if (!jdSkills) return [];
  return [
    ...jdSkills.tech_stack,
    ...jdSkills.technical_skills,
    ...jdSkills.other_skills,
    ...jdSkills.required_skills,
    ...jdSkills.nice_to_have,
  ];
}
