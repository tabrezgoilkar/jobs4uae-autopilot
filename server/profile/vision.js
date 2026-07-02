import { normalizeProfile } from './schema.js';

// Extracts a structured profile from screenshot(s) of a LinkedIn profile using a
// vision-capable AI engine. This is the "full profile" path (skills, all roles,
// the long About) — it reads whatever is visible in the images. Anti-fabrication:
// transcribe only what is shown; never invent. Multiple images are read together
// so a long profile can be captured in a few shots.

const SYSTEM = [
  'You transcribe a person\'s LinkedIn profile from screenshots into JSON.',
  'Rules: use ONLY information visible in the images. Never invent, guess, or embellish.',
  'If a field is not visible, leave it empty ("") or an empty array. Do not add skills or roles that are not shown.',
].join(' ');

const PROMPT = [
  'Extract this LinkedIn profile as JSON with exactly these keys:',
  '{ "fullName": string, "headline": string, "location": string, "summary": string,',
  '  "skills": string[],',
  '  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "description": string }],',
  '  "education": [{ "institution": string, "degree": string, "field": string, "year": string }],',
  '  "certifications": [{ "name": string, "issuer": string, "year": string }],',
  '  "languages": [{ "name": string, "level": string }] }',
  'Dates as "YYYY-MM" or "YYYY"; use "Present" for current roles. Output ONLY the JSON, no prose.',
].join('\n');

/** Pull a JSON object out of a model reply (tolerates ```json fences / surrounding prose). */
function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * @param {Array<{base64:string, mimeType:string}>} images
 * @param {{ generateVision?: Function }} engine
 * @returns {Promise<object>} normalized profile
 */
export async function extractProfileFromImages(images, engine) {
  if (!engine || typeof engine.generateVision !== 'function') {
    throw new Error("The selected AI engine can't read images. Switch to Gemini or OpenRouter in Settings.");
  }
  const text = await engine.generateVision({ system: SYSTEM, prompt: PROMPT, images });
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== 'object') {
    throw new Error('Could not read a profile from those images. Try clearer, full screenshots of your profile.');
  }
  return normalizeProfile(raw);
}
