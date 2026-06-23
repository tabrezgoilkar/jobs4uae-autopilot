import type { Profile } from '../api';

export interface Suggestion {
  title: string;
  detail: string;
}
export interface ProfileAnalysis {
  score: number;
  suggestions: Suggestion[];
}

const has = (v?: string) => !!v?.trim();
const any = (a?: unknown[]) => (a?.length ?? 0) >= 1;

/**
 * Deterministic, honest profile-strength score (0–100). Weights cover EVERY
 * section the profile can hold — including projects, certifications, languages
 * and awards — so 100% genuinely means a complete profile, not an unearned max.
 * No AI involved.
 */
export function analyzeProfile(p: Profile): ProfileAnalysis {
  let score = 0;
  const add = (cond: boolean, pts: number) => { if (cond) score += pts; };

  // Identity & contact (34)
  add(has(p.fullName), 8);
  add(has(p.headline), 8);
  add(has(p.email), 6);
  add(has(p.phone), 6);
  add(has(p.location), 6);

  // Summary, length-scaled (14) and skills (12)
  score += Math.min(14, Math.round(((p.summary?.trim().length ?? 0) / 200) * 14));
  score += Math.min(12, (p.skills?.length ?? 0) * 3);

  // Core history (21)
  add(any(p.experience), 14);
  add(any(p.education), 7);

  // Extra sections (19) — previously uncounted, which made 100% too easy.
  add(any(p.projects), 6);
  add(any(p.certifications), 5);
  add(any(p.languages), 4);
  add(any(p.awards), 4);

  score = Math.max(0, Math.min(100, score));

  const suggestions: Suggestion[] = [];
  if (!has(p.headline)) suggestions.push({ title: 'Add a headline', detail: 'A current title (e.g. "Senior Accountant") helps employers place you instantly.' });
  if ((p.summary?.trim().length ?? 0) < 120) suggestions.push({ title: 'Strengthen your summary', detail: 'Aim for 2–3 sentences covering your strongest, most relevant experience.' });
  if ((p.skills?.length ?? 0) < 5) suggestions.push({ title: 'Add more skills', detail: 'List at least 5 relevant skills — they drive your job-match score.' });
  if (p.experience?.some((x) => !x.description?.trim())) suggestions.push({ title: 'Add results to your roles', detail: 'Numbers beat adjectives — e.g. "cut checkout drop-off 18%".' });
  if (!any(p.projects)) suggestions.push({ title: 'Add a project', detail: 'A standout project shows impact beyond your job titles.' });
  if (!any(p.certifications)) suggestions.push({ title: 'Add certifications', detail: 'Relevant certs (e.g. PMP, AWS, ISO) strengthen credibility.' });
  if (!any(p.languages)) suggestions.push({ title: 'Add languages', detail: 'Languages matter in the GCC — list those you speak.' });
  if (!any(p.awards)) suggestions.push({ title: 'Add awards', detail: 'Recognition and awards help you stand out.' });
  if (!has(p.phone)) suggestions.push({ title: 'Add a phone number', detail: 'So employers can reach you quickly.' });
  if (!has(p.location)) suggestions.push({ title: 'Add your location', detail: 'City and country (e.g. "Dubai, UAE").' });

  return { score, suggestions };
}
