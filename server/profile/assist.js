import { extractJson } from '../lib/json.js';
import { normalizeProfile } from './schema.js';

// The agentic profile assistant. Given the user's current profile + a plain-language
// request ("I led X project at Y", or "improve my CV"), it proposes an updated
// profile and/or asks clarifying questions — and NEVER invents facts. The proposal
// is returned for the user to confirm; it is NOT saved here.
const SYSTEM =
  'You are an expert CV editor and career assistant for the GCC job market. You improve grammar, ' +
  'spelling and professionalism, and use strong, keyword-rich, ATS-friendly wording. You help the ' +
  'user build their profile from plain-language input. You NEVER invent employers, titles, dates, ' +
  'metrics, skills or qualifications — if a needed fact is missing, you ASK. Return ONLY valid JSON.';

function buildPrompt(profile, message) {
  return `The user's CURRENT profile (JSON):
${JSON.stringify(profile)}

The user's request:
"""${message}"""

Decide:
- If you can apply the request using ONLY the information given plus what's already in the profile,
  return the FULL updated profile in "profile" with a short "reply" describing what you changed.
- For "improve"/"polish" requests: fix grammar/spelling and rewrite summary + experience/project
  descriptions in professional, keyword-rich language. Keep bullet points as lines starting with "- ".
  Do NOT add facts, numbers, employers or skills that aren't already there.
- If a fact only the user knows is required (e.g. dates, the company, a metric), set "profile" to null
  and put up to 3 short "questions".

Keep the profile's existing JSON keys. In every string value, escape any double quotes as \\" and
newlines as \\n.

Return ONLY: {"reply": string, "questions": string[], "profile": <full profile JSON> | null}`;
}

export async function assistProfile(profile, message, engine) {
  let parsed;
  try {
    parsed = extractJson(await engine.generate({ system: SYSTEM, prompt: buildPrompt(profile, message) }));
  } catch (e) {
    throw new Error(`Could not understand the assistant's response. ${e.message}`);
  }
  return {
    reply: String(parsed?.reply ?? '').trim(),
    questions: Array.isArray(parsed?.questions) ? parsed.questions.map(String).map((s) => s.trim()).filter(Boolean) : [],
    proposed: parsed?.profile && typeof parsed.profile === 'object' ? normalizeProfile(parsed.profile) : null,
  };
}
