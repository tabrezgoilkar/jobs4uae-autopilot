import { extractJson } from '../lib/json.js';

export { extractJson };

const SYSTEM = 'You convert a raw CV/resume into structured JSON. Return ONLY valid JSON, no commentary.';

function buildPrompt(cvText) {
  return `Extract this resume into JSON with EXACTLY these keys:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "headline": string,
  "summary": string,
  "skills": string[],
  "experience": [ { "company": string, "title": string, "startDate": string, "endDate": string, "description": string } ],
  "education": [ { "institution": string, "degree": string, "field": string, "year": string } ],
  "projects": [ { "name": string, "description": string, "tech": string[], "url": string } ],
  "certifications": [ { "name": string, "issuer": string, "year": string, "url": string } ],
  "languages": [ { "name": string, "level": string } ],
  "awards": [ { "title": string, "issuer": string, "year": string, "description": string } ],
  "links": string[]
}
Use empty strings/arrays for anything not present. Do not invent information.

RESUME:
"""
${cvText}
"""`;
}

export async function parseCvText(cvText, engine) {
  const raw = await engine.generate({ system: SYSTEM, prompt: buildPrompt(cvText) });
  try {
    return extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while reading your CV. ${e.message}`);
  }
}
