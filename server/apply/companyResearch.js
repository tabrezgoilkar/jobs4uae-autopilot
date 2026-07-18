// Company research + interview prep — the CrewAI "company_researcher" idea,
// ported to our cloud-safe engine (BYOK / Ollama / Gemini). Given a company
// name (derived from a job listing or pasted by the user), an LLM returns a
// concise, honest briefing: market position, culture signals, and likely
// interview questions. No separate web-search key required — the model uses
// its own knowledge; the prompt forbids inventing specifics it can't stand
// behind. Cloud-safe (engine-backed, setup-wizard gated).

import { extractJson } from '../lib/json.js';

const RESEARCH_SYSTEM = `You are a company research analyst helping a jobseeker prepare. Given a company name, produce a concise, honest briefing.

RULES — non-negotiable:
- Use only well-established, widely-known facts. If you are unsure about a specific detail, say "I'm not certain" rather than inventing it.
- Do NOT fabricate recent news, funding rounds, layoffs, or quotes. If you lack current info, state that plainly.
- Keep each section short and skimmable. Return STRICT JSON:
{
  "snapshot": string,            // 1–2 sentence positioning of the company
  "market_position": string,     // what they're known for, competitors, scale if known
  "culture_signals": string[],   // 2–4 observable culture themes
  "interview_questions": string[] // 3–5 role-agnostic questions they may ask
}`;

function buildResearchPrompt(company) {
  return `Company: ${company}\n\nProvide the research briefing as strict JSON only.`;
}

/**
 * @returns {Promise<{snapshot:string, market_position:string, culture_signals:string[], interview_questions:string[]}>}
 */
export async function researchCompany({ company, engine }) {
  const text = await engine.generate({
    system: RESEARCH_SYSTEM,
    prompt: buildResearchPrompt(company),
  });
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    throw new Error(`Company research returned no usable JSON. ${e.message}`);
  }
  return {
    snapshot: String(parsed.snapshot ?? ''),
    market_position: String(parsed.market_position ?? ''),
    culture_signals: Array.isArray(parsed.culture_signals) ? parsed.culture_signals : [],
    interview_questions: Array.isArray(parsed.interview_questions) ? parsed.interview_questions : [],
  };
}
