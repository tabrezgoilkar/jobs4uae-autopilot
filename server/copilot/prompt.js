// System prompt + prompt builder for the Career Copilot (Phase 16).
// The copilot answers questions about the GCC/UAE job market, visas and
// labour law, and about the user's own profile/evaluations. It must be
// honest, concise, and never present itself as a lawyer.

export const COPILOT_SYSTEM = [
  'You are the Career Copilot inside Jobs4UAE Autopilot, a free job-search assistant for the GCC region',
  '(UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman).',
  'You help job seekers with: the GCC/UAE job market, CVs and applications, interview prep,',
  'and general UAE labour-law / visa / end-of-service questions.',
  '',
  'Rules:',
  '- Be concise and practical. Prefer short paragraphs and concrete, GCC-specific guidance.',
  '- When you reference UAE labour law, you may cite the framework (e.g. Federal Decree-Law No. 33 of 2021, MOHRE)',
  '  but ALWAYS add that this is general guidance, not legal advice, and to verify with MOHRE or a professional.',
  '- If the user has shared profile/CV details, ground your answer in them when relevant.',
  '- Never invent facts about the user, employers, or specific job postings. If you do not know, say so.',
  '- Do not claim to have taken actions (scanning, applying). You only answer and advise.',
].join('\n');

/**
 * Build the user-turn prompt for the copilot.
 * @param {object} opts
 * @param {object} [opts.profile]      - The user's profile (may be empty).
 * @param {Array}  [opts.evaluations]  - Recent evaluations for light context.
 * @param {string} opts.question       - The user's question.
 * @param {Array}  [opts.history]      - Prior [{role:'user'|'assistant', content}] turns.
 */
export function buildCopilotPrompt({ profile, evaluations = [], question, history = [] } = {}) {
  const parts = [];

  const ctx = profileContext(profile);
  if (ctx) parts.push(`About the user (for context, use only if relevant):\n${ctx}`);

  if (evaluations.length) {
    const lines = evaluations.slice(0, 5).map((e) => {
      const where = [e.company, e.location].filter(Boolean).join(', ');
      return `- ${e.jobTitle || 'A role'}${where ? ` (${where})` : ''}: graded ${e.grade}`;
    });
    parts.push(`The user's recent job evaluations:\n${lines.join('\n')}`);
  }

  if (history.length) {
    const convo = history
      .slice(-6)
      .map((m) => `${m.role === 'assistant' ? 'Copilot' : 'User'}: ${String(m.content ?? '').trim()}`)
      .join('\n');
    parts.push(`Conversation so far:\n${convo}`);
  }

  parts.push(`User's question:\n${question}`);
  parts.push('Answer helpfully and concisely.');
  return parts.join('\n\n');
}

function profileContext(profile) {
  if (!profile) return '';
  const bits = [];
  if (profile.headline) bits.push(`Headline: ${profile.headline}`);
  if (profile.location) bits.push(`Location: ${profile.location}`);
  if (Array.isArray(profile.skills) && profile.skills.length) {
    bits.push(`Skills: ${profile.skills.slice(0, 20).join(', ')}`);
  }
  if (Array.isArray(profile.experience) && profile.experience.length) {
    const titles = profile.experience.slice(0, 3).map((x) => x.title).filter(Boolean);
    if (titles.length) bits.push(`Recent roles: ${titles.join('; ')}`);
  }
  return bits.join('\n');
}
