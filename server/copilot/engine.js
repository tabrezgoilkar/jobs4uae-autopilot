import { COPILOT_SYSTEM, buildCopilotPrompt } from './prompt.js';

/**
 * Ask the career copilot a question.
 * @returns {Promise<{answer: string}>}
 */
export async function askCopilot({ profile, evaluations, question, history }, engine) {
  const raw = await engine.generate({
    system: COPILOT_SYSTEM,
    prompt: buildCopilotPrompt({ profile, evaluations, question, history }),
  });
  return { answer: String(raw ?? '').trim() };
}
