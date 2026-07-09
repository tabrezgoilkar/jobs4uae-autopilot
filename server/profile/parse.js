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

FORMATTING — preserve the resume's structure inside the text fields using **Markdown**:
- "summary": keep paragraphs as written.
- experience/projects/awards "description": keep the intro sentence(s) as a short paragraph, then
  EACH achievement/responsibility as its own Markdown bullet line starting with "- ". Preserve any
  bold lead-ins as "**bold**" (e.g. "- **Directed IT strategy** across the enterprise…"). Keep the
  original wording — do not summarise or drop bullets.

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
    // Log the raw model output (truncated) so future parse failures are
    // diagnosable from server logs instead of only the terminal error snippet.
    const snippet = String(raw ?? '').slice(0, 2000);
    console.warn('[cv-import] unparseable AI response:', e.message, '\n---raw---\n', snippet);
    throw new Error(`Could not understand the AI response while reading your CV. ${e.message}`);
  }
}
