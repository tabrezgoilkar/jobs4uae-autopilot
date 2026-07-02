import { normalizeProfile } from './schema.js';
import { renderProfileToMarkdown } from '../documents/baseline.js';

// After an import, produce the "baseline": fill a blank professional summary from
// the real experience (anti-fabrication) and render a deterministic base CV in
// Markdown. Every AI step is best-effort — no engine / offline just skips it, the
// import still succeeds. Never overwrites the user's own summary.

const SYSTEM =
  'You write concise, professional CV summaries using ONLY the facts provided. Never invent employers, titles, dates, metrics or skills.';

function summaryPrompt(profile) {
  const roles = (profile.experience ?? [])
    .map((e) => [e.title, e.company].filter(Boolean).join(' at '))
    .filter(Boolean)
    .join('; ');
  const skills = (profile.skills ?? []).join(', ');
  return [
    'Write a 2-3 sentence first-person-free professional summary for this person.',
    `Headline: ${profile.headline || '(none)'}`,
    `Roles: ${roles || '(none)'}`,
    `Skills: ${skills || '(none)'}`,
    'Use only the above. Do not invent anything. Output only the summary text.',
  ].join('\n');
}

/**
 * @returns {Promise<{ profile: object, baselineMarkdown: string, summaryGenerated: boolean }>}
 */
export async function buildBaseline(profile, engine) {
  const p = normalizeProfile(profile);
  let summaryGenerated = false;

  const canSummarize = !p.summary?.trim() && p.experience.length > 0 && typeof engine?.generate === 'function';
  if (canSummarize) {
    try {
      const text = (await engine.generate({ system: SYSTEM, prompt: summaryPrompt(p) }))?.trim();
      if (text) {
        p.summary = text;
        summaryGenerated = true;
      }
    } catch {
      // best-effort — leave the summary blank, import still succeeds
    }
  }

  return { profile: p, baselineMarkdown: renderProfileToMarkdown(p), summaryGenerated };
}
