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
  if (exps.length === 0) return { earned: 0, max: 16, note: 'No experience added yet' };

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
  // Two independent caps so padding plain bullets can't earn the top score:
  //   • up to 8 for simply having bullets (base)
  //   • up to 8 ONLY for quantified / action-led results (so metrics are required for "excellent")
  const base = Math.min(8, bulletCount * 1.0);
  const impact = Math.min(8, actionVerb * 1.5 + withMetric * 4);
  const earned = Math.round(base + impact);
  const note = bulletCount === 0
    ? 'Add bullet points describing what you did'
    : `$${bulletCount} bullets${actionVerb ? `, ${actionVerb} action-led` : ''}${withMetric ? `, ${withMetric} with a metric` : ', none quantified'}`;
  return { earned, max: 16, note };
}

function analyzeSummaryQuality(profile: Profile): { earned: number; max: number; note: string } {
  const s = clean(profile.summary);
  if (!s) return { earned: 0, max: 8, note: 'No summary yet' };
  const len = s.length;
  const metric = countMetric(s);
  // good summary: 120–400 chars, ideally with at least one metric
  let earned = Math.min(8, Math.round((Math.min(len, 320) / 320) * 5) + (metric ? 3 : 0));
  const note = len < 60 ? 'Summary is very short' : metric ? 'Includes a concrete result' : 'Add a metric or result';
  return { earned, max: 8, note };
}

function analyzeSkillsQuality(profile: Profile): { earned: number; max: number; note: string } {
  const sk = (profile.skills ?? []).map(clean).filter(Boolean);
  if (sk.length === 0) return { earned: 0, max: 10, note: 'No skills listed' };
  const earned = Math.min(10, sk.length * 2);
  return { earned, max: 10, note: `${sk.length} skills listed` };
}

/**
 * Deterministic, honest profile-strength score (0–100).
 *
 * Two dimensions:
 *   • Completeness (0–60): is the CV *whole*? Identity + core sections + at least
 *     one credibility section (project / certification / award / language). A CV
 *     with no credibility section is structurally incomplete and caps out below 80.
 *   • Quality (0–40): is the *content* strong? Action-led, quantified experience;
 *     a real summary; a healthy skills list; and rounding out 2+ extra sections.
 *
 * A "very basic" CV (identity + summary + plain-task experience + a few skills,
 * but NO certs/awards/projects/languages and no metrics) scores in the 60s — not 100.
 * Only a CV that is both complete AND has quantified impact can reach the top.
 */
export function analyzeProfile(p: Profile): ProfileAnalysis {
  // ---------- Completeness (60) ----------
  let completeness = 0;
  const cFactors: ScoreFactor[] = [];
  const c = (key: string, label: string, cond: boolean, pts: number, note: string) => {
    if (cond) completeness += pts;
    cFactors.push({ key, label, earned: cond ? pts : 0, max: pts, note: cond ? note : 'Missing' });
  };
  // Identity (26)
  c('name', 'Full name', has(p.fullName), 6, 'Added');
  c('headline', 'Headline / title', has(p.headline), 6, 'Added');
  c('email', 'Email', has(p.email), 5, 'Added');
  c('phone', 'Phone', has(p.phone), 5, 'Added');
  c('location', 'Location', has(p.location), 4, 'Added');
  // Core sections (19)
  c('exp', 'Work experience', any(p.experience), 8, 'Added');
  c('edu', 'Education', any(p.education), 5, 'Added');
  c('summary', 'Summary present', has(p.summary), 6, 'Added');
  // Credibility (15) — at least one of these makes a CV "complete"; none caps completeness at 45/60
  const hasProject = any(p.projects);
  const hasCert = any(p.certifications);
  const hasAward = any(p.awards);
  const hasLang = any(p.languages);
  const credPts = (hasProject ? 5 : 0) + (hasCert ? 5 : 0) + (hasAward ? 5 : 0) + (hasLang ? 3 : 0);
  const credibility = Math.min(15, credPts);
  c('credibility', 'Credibility section', credPts > 0, credibility, credPts > 0 ? 'Added' : 'Missing — add a project / cert / award / language');

  // ---------- Quality (40) ----------
  const expQ = analyzeExperienceQuality(p);
  const sumQ = analyzeSummaryQuality(p);
  const skQ = analyzeSkillsQuality(p);
  // Polish: extra rounding (2+ credibility sections, or links/photo) — small, not a gap-filler
  const extraCount = [hasProject, hasCert, hasAward, hasLang].filter(Boolean).length;
  const polish = Math.min(6, extraCount >= 2 ? 6 : extraCount === 1 ? 3 : 0);
  const quality = expQ.earned + sumQ.earned + skQ.earned + polish;
  const qFactors: ScoreFactor[] = [
    { key: 'experience', label: 'Experience impact', earned: expQ.earned, max: expQ.max, note: expQ.note },
    { key: 'summary', label: 'Summary strength', earned: sumQ.earned, max: sumQ.max, note: sumQ.note },
    { key: 'skills', label: 'Skills depth', earned: skQ.earned, max: skQ.max, note: skQ.note },
    { key: 'polish', label: 'Extra polish', earned: polish, max: 6, note: polish ? 'Rounded out with extra sections' : 'Add 2+ of projects/certs/awards/languages' },
  ];

  const total = Math.max(0, Math.min(100, completeness + quality));

  const factors = [...cFactors, ...qFactors];

  const suggestions: Suggestion[] = [];
  if (!has(p.headline)) suggestions.push({ title: 'Add a headline', detail: 'A current title (e.g. "Senior Accountant") helps employers place you instantly.', section: 'basics' });
  if ((p.summary?.trim().length ?? 0) < 120) suggestions.push({ title: 'Strengthen your summary', detail: 'Aim for 2–3 sentences covering your strongest, most relevant experience — and add a concrete result.', section: 'basics' });
  if ((p.skills?.length ?? 0) < 6) suggestions.push({ title: 'Add more skills', detail: 'List at least 6 relevant skills — they drive your job-match score.', section: 'basics' });
  if (expQ.earned < expQ.max) {
    suggestions.push({ title: 'Make experience bullet-driven & quantified', detail: 'Lead each bullet with an action verb (Led, Built, Cut) and add a number — e.g. "cut checkout drop-off 18%".', section: 'experience' });
  }
  if (!hasProject) suggestions.push({ title: 'Add a project', detail: 'A standout project shows impact beyond your job titles.', section: 'projects' });
  if (!hasCert) suggestions.push({ title: 'Add certifications', detail: 'Relevant certs (e.g. PMP, AWS, ISO) strengthen credibility — and unlock a higher strength score.', section: 'certifications' });
  if (!hasAward) suggestions.push({ title: 'Add awards', detail: 'Recognition and awards help you stand out.', section: 'awards' });
  if (!hasLang) suggestions.push({ title: 'Add languages', detail: 'Languages matter in the GCC — list those you speak.', section: 'languages' });
  if (!has(p.phone)) suggestions.push({ title: 'Add a phone number', detail: 'So employers can reach you quickly.', section: 'basics' });
  if (!has(p.location)) suggestions.push({ title: 'Add your location', detail: 'City and country (e.g. "Dubai, UAE").', section: 'basics' });

  return { score: total, quality, completeness, factors, suggestions };
}
