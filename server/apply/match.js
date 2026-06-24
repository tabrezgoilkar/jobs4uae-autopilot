import { extractJson } from '../lib/json.js';
import { normalizeKey } from './answers/store.js';

// AI answer-matcher for screening questions. The anti-fabrication rule is the
// whole point: a factual answer is only ever filled from the user's stored data,
// or asked. The AI may *draft* free-text from the real profile (clearly an
// editable draft), but never invents facts (salary, visa, nationality, dates,
// years of experience, certifications). On any doubt it returns "ask".

const SYSTEM =
  'You help fill a job application form for a real person. You NEVER invent facts. ' +
  'You only reuse answers the user has actually provided, or draft open-ended free-text from their real profile. Return ONLY JSON.';

function buildPrompt(label, fields, memory, profile, job) {
  const known = {
    ...fields,
    ...Object.fromEntries(memory.map((m) => [m.questionLabel, m.answer])),
  };
  return `FORM QUESTION:
"""${label}"""

ANSWERS THE USER HAS ALREADY PROVIDED (the ONLY source for factual answers):
${JSON.stringify(known, null, 2)}

THE USER'S REAL PROFILE (for drafting open-ended answers only — not a source of new facts):
${JSON.stringify({ headline: profile.headline, summary: profile.summary, skills: profile.skills }, null, 2)}

JOB CONTEXT: ${job}

Decide ONE of:
- "fill": a provided answer above clearly answers this question — return it verbatim in "answer".
- "draft": the question is OPEN-ENDED free-text (e.g. "why are you a good fit", "cover note") — draft a short answer from the real profile in "answer". Do not state facts not in the profile.
- "ask": the question needs a FACT we do not have (salary, visa/nationality, dates, years of experience, certifications, etc.). Do NOT guess.

Return ONLY: {"action":"fill"|"draft"|"ask","answer":"..."}`;
}

export async function matchQuestion(question, context, engine) {
  const { fields = {}, memory = [], profile = {}, job = '' } = context ?? {};
  const label = String(question?.label ?? question ?? '').trim();
  if (!label) return { action: 'ask', answer: '', source: 'unknown' };

  // Exact remembered answer — deterministic, no AI call.
  const key = normalizeKey(label);
  const mem = memory.find((m) => m.normalizedKey === key);
  if (mem) return { action: 'fill', answer: mem.answer, source: 'memory' };

  let parsed;
  try {
    parsed = extractJson(await engine.generate({ system: SYSTEM, prompt: buildPrompt(label, fields, memory, profile, job) }));
  } catch {
    return { action: 'ask', answer: '', source: 'unknown' };
  }

  const answer = String(parsed?.answer ?? '').trim();
  if (parsed?.action === 'fill' && answer) return { action: 'fill', answer, source: 'matched' };
  if (parsed?.action === 'draft' && answer) return { action: 'draft', answer, source: 'ai-draft' };
  return { action: 'ask', answer: '', source: 'unknown' };
}
