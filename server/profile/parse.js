export function extractJson(text) {
  if (!text) throw new Error('Empty AI response.');
  let t = String(text).trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI did not return JSON.');
  return JSON.parse(t.slice(start, end + 1));
}

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
