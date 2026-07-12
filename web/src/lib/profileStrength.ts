import type { Profile } from '../api';

export type ProfileSection =
  | 'basics' | 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards';

export interface Suggestion {
  title: string;
  detail: string;
  section: ProfileSection;
}

export interface ScoreFactor {
  key: string;
  label: string;
  /** points earned out of max (both 0–max) */
  earned: number;
  max: number;
  /** short note explaining the earned value */
  note: string;
}

export interface ProfileAnalysis {
  score: number;
  /** 0–100 quality dimension — how *strong* the content is, independent of completeness */
  quality: number;
  completeness: number;
  factors: ScoreFactor[];
  suggestions: Suggestion[];
}

const has = (v?: string) => !!v?.trim();
const any = (a?: unknown[]) => (a?.length ?? 0) >= 1;
const clean = (v?: string) => (typeof v === 'string' ? v.trim() : '');

/**
 * Strong, achievement-oriented action verbs — a CV that leads bullets with these
 * reads as results-driven. Used by the quality heuristic.
 */
const ACTION_VERBS = new Set([
  'led', 'built', 'drove', 'launched', 'owned', 'delivered', 'improved', 'increased', 'reduced',
  'cut', 'grew', 'scaled', 'designed', 'created', 'implemented', 'managed', 'achieved', 'saved',
  'boosted', 'optimized', 'spearheaded', 'negotiated', 'automated', 'streamlined', 'raised',
  'generated', 'won', 'shipped', 'transformed', 'mentored', 'established', 'secured', 'exceeded',
]);

function countMetric(text: string): number {
  // percentages, currency, x-multipliers, and "N+" style quantities
  const m = text.match(/%|\$|(?:K|M|k|m)\b|\b\d+\s*\+|\b\d+x\b|\bx\d\b|\d+\s*(?:users|clients|customers|projects|teams|people|members|countries|regions|%)/gi);
  return m ? m.length : 0;
}

function analyzeExperienceQuality(profile: Profile): { earned: number; max: number; note: string } {
  const exps = (profile.experience ?? []).filter((x) => clean(x?.description) || clean(x?.title));
  if (exps.length === 0) return { earned: 0, max: 26, note: 'No experience added yet' };

  let bulletCount = 0;
  let actionVerb = 0;
  let withMetric = 0;
  for (const x of exps) {
    const lines = clean(x.description)
      .split(/\n+/)
      .map((l) => l.replace(/^[\s•‣◦⁃∙\-*]+\s*/, '').trim())
      .filter(Boolean);
    bulletCount += lines.length;
    for (const l of lines) {
      const first = l.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (first && ACTION_VERBS.has(first)) actionVerb++;
      if (countMetric(l) > 0) withMetric++;
    }
  }
  // reward: at least 2 bullets/role, action-led bullets, and quantified results
  const earned = Math.min(26, Math.round(bulletCount * 1.5) + Math.min(8, actionVerb * 2) + Math.min(8, withMetric * 3));
  const note = bulletCount === 0
    ? 'Add bullet points describing what you did'
    : `$${bulletCount} bullets, ${actionVerb} action-led${withMetric ? `, ${withMetric} with a metric` : ''}`;
  return { earned, max: 26, note };
}

function analyzeSummaryQuality(profile: Profile): { earned: number; max: number; note: string } {
  const s = clean(profile.summary);
  if (!s) return { earned: 0, max: 12, note: 'No summary yet' };
  const len = s.length;
  const metric = countMetric(s);
  // good summary: 120–600 chars, ideally with at least one metric
  let earned = Math.min(12, Math.round((Math.min(len, 400) / 400) * 8) + (metric ? 4 : 0));
  const note = len < 60 ? 'Summary is very short' : metric ? 'Includes a concrete result' : 'Add a metric or result';
  return { earned, max: 12, note };
}

function analyzeSkillsQuality(profile: Profile): { earned: number; max: number; note: string } {
  const sk = (profile.skills ?? []).map(clean).filter(Boolean);
  if (sk.length === 0) return { earned: 0, max: 12, note: 'No skills listed' };
  const earned = Math.min(12, sk.length * 2);
  return { earned, max: 12, note: `${sk.length} skills listed` };
}

/**
 * Deterministic, honest profile-strength score (0–100).
 *
 * It combines TWO independent dimensions so a bare-bones CV can no longer score
 * ~91% on completeness alone:
 *   • Completeness (0–46): does every section exist? (identity, contact, history)
 *   • Quality (0–54): is the *content* strong? (action-led, quantified experience;
 *     a real summary; a healthy skills list; breadth of extra sections)
 *
 * No AI is involved — the quality checks are transparent heuristics the UI shows
 * back to the user as a breakdown ("why this score").
 */
export function analyzeProfile(p: Profile): ProfileAnalysis {
  // ---------- Completeness (46) ----------
  let completeness = 0;
  const cFactors: ScoreFactor[] = [];
  const c = (key: string, label: string, cond: boolean, pts: number, note: string) => {
    if (cond) completeness += pts;
    cFactors.push({ key, label, earned: cond ? pts : 0, max: pts, note: cond ? note : 'Missing' });
  };
  c('name', 'Full name', has(p.fullName), 6, 'Added');
  c('headline', 'Headline / title', has(p.headline), 6, 'Added');
  c('email', 'Email', has(p.email), 4, 'Added');
  c('phone', 'Phone', has(p.phone), 4, 'Added');
  c('location', 'Location', has(p.location), 4, 'Added');
  c('exp', 'Work experience', any(p.experience), 10, 'Added');
  c('edu', 'Education', any(p.education), 6, 'Added');
  c('summary', 'Summary present', has(p.summary), 6, 'Added');

  // ---------- Quality (54) ----------
  const expQ = analyzeExperienceQuality(p);
  const sumQ = analyzeSummaryQuality(p);
  const skQ = analyzeSkillsQuality(p);
  // breadth: extra sections that show a well-rounded candidate
  const breadth = Math.min(12, (
    (any(p.projects) ? 3 : 0) + (any(p.certifications) ? 3 : 0) +
    (any(p.languages) ? 2 : 0) + (any(p.awards) ? 2 : 0) + (any(p.links) ? 2 : 0)
  ));
  const quality = expQ.earned + sumQ.earned + skQ.earned + breadth;
  const qFactors: ScoreFactor[] = [
    { key: 'experience', label: 'Experience impact', earned: expQ.earned, max: expQ.max, note: expQ.note },
    { key: 'summary', label: 'Summary strength', earned: sumQ.earned, max: sumQ.max, note: sumQ.note },
    { key: 'skills', label: 'Skills depth', earned: skQ.earned, max: skQ.max, note: skQ.note },
    { key: 'breadth', label: 'Profile breadth', earned: breadth, max: 12, note: breadth ? 'Extra sections filled in' : 'Add projects/certs/languages' },
  ];

  const total = Math.max(0, Math.min(100, completeness + quality));

  const factors = [...cFactors, ...qFactors];

  const suggestions: Suggestion[] = [];
  if (!has(p.headline)) suggestions.push({ title: 'Add a headline', detail: 'A current title (e.g. "Senior Accountant") helps employers place you instantly.', section: 'basics' });
  if ((p.summary?.trim().length ?? 0) < 120) suggestions.push({ title: 'Strengthen your summary', detail: 'Aim for 2–3 sentences covering your strongest, most relevant experience — and add a concrete result.', section: 'basics' });
  if ((p.skills?.length ?? 0) < 6) suggestions.push({ title: 'Add more skills', detail: 'List at least 6 relevant skills — they drive your job-match score.', section: 'basics' });
  if (expQ.earned < expQ.max && (p.experience?.some((x) => !x.description?.trim()) || expQ.earned < 14)) {
    suggestions.push({ title: 'Make experience bullet-driven', detail: 'Lead each bullet with an action verb (Led, Built, Cut) and add a number — e.g. "cut checkout drop-off 18%".', section: 'experience' });
  }
  if (!any(p.projects)) suggestions.push({ title: 'Add a project', detail: 'A standout project shows impact beyond your job titles.', section: 'projects' });
  if (!any(p.certifications)) suggestions.push({ title: 'Add certifications', detail: 'Relevant certs (e.g. PMP, AWS, ISO) strengthen credibility.', section: 'certifications' });
  if (!any(p.languages)) suggestions.push({ title: 'Add languages', detail: 'Languages matter in the GCC — list those you speak.', section: 'languages' });
  if (!any(p.awards)) suggestions.push({ title: 'Add awards', detail: 'Recognition and awards help you stand out.', section: 'awards' });
  if (!has(p.phone)) suggestions.push({ title: 'Add a phone number', detail: 'So employers can reach you quickly.', section: 'basics' });
  if (!has(p.location)) suggestions.push({ title: 'Add your location', detail: 'City and country (e.g. "Dubai, UAE").', section: 'basics' });

  return { score: total, quality, completeness, factors, suggestions };
}
