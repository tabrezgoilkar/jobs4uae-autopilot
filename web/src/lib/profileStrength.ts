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
  earned: number;
  max: number;
  /** evidence line — what in the CV supported (or cost) this score */
  note: string;
}

export interface ScoreSection {
  id: string;            // A | B | C | D
  label: string;         // Parseability | Completeness | Content strength | Targeting
  earned: number;
  max: number;
  criteria: ScoreFactor[];
}

export type ScoreMode = 'ROLE_ONLY' | 'UNTARGETED_85' | 'JD_PROVIDED';

export interface ProfileAnalysis {
  score: number;                 // normalized 0–100
  sections: ScoreSection[];      // A, B, C, D
  subtotals: { parseability: number; completeness: number; content: number; targeting: number };
  mode: ScoreMode;
  keywordSet: string[];
  gradeBand: string;
  /** legacy flat factors (used by older UI) */
  factors: ScoreFactor[];
  /** legacy dimensions for backward-compat with the rail's two chips */
  completeness: number;
  quality: number;
  suggestions: Suggestion[];
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
const has = (v?: string) => !!v?.trim();
const any = (a?: unknown[]) => (a?.length ?? 0) >= 1;
const clean = (v?: string) => (typeof v === 'string' ? v.trim() : '');

const ACTION_VERBS = new Set([
  'led', 'built', 'drove', 'launched', 'owned', 'delivered', 'improved', 'increased', 'reduced',
  'cut', 'grew', 'scaled', 'designed', 'created', 'implemented', 'managed', 'achieved', 'saved',
  'boosted', 'optimized', 'spearheaded', 'negotiated', 'automated', 'streamlined', 'raised',
  'generated', 'won', 'shipped', 'transformed', 'mentored', 'established', 'secured', 'exceeded',
  'authored', 'directed', 'produced', 'partnered', 'resolved', 'accelerated', 'modernized',
]);

const DUTY_FRAMING = ['responsible for', 'duties included', 'responsibilities include', 'helped with', 'tasked with', 'worked on', 'involved in'];

const FILLER_SKILLS = new Set(['ms word', 'word', 'notepad', 'email', 'teamwork', 'communication', 'microsoft office', 'internet']);

const SCOPE_SIGNALS = ['budget', 'team of', 'team size', 'managed', 'led', 'users', 'customers', 'clients', 'revenue', 'vendor', 'contract', 'multi-site', 'multi-site', 'region', 'country', 'gcc', 'uae', 'department', 'p&l', 'portfolio', 'headcount', 'staff'];

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

function countMetric(text: string): number {
  const m = text.match(/%|\$|(?:K|M|k|m)\b|\b\d+\s*\+|\b\d+x\b|\bx\d\b|\d+\s*(?:users|clients|customers|projects|teams|people|members|countries|regions|%)/gi);
  return m ? m.length : 0;
}

function bulletsOf(description?: string): string[] {
  return clean(description)
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•‣◦⁃∙\-*]+\s*/, '').trim())
    .filter(Boolean);
}

function splitNamePhoneCountry(phone?: string): { hasCountryCode: boolean } {
  const phoneClean = clean(phone);
  const hasCountryCode = /^\+?\d[\d\s().-]{7,}$/.test(phoneClean) && phoneClean.replace(/[^\d]/g, '').length >= 9 && (phoneClean.startsWith('+') || /\b(971|1|44|91|92)\b/.test(phoneClean.replace(/[^\d]/g, '').slice(0, 3)));
  return { hasCountryCode };
}

// Built-in market keyword sets (ROLE_ONLY mode). Matched against the headline.
const ROLE_KEYWORDS: Record<string, string[]> = {
  draftsman: ['autocad', 'revit', 'navisworks', 'bim', 'rhino', 'sketchup', 'shop drawings', 'gfc', '3ds max', 'bar bending', 'bill of quantities', 'etabs'],
  architect: ['autocad', 'revit', 'bim', 'sketchup', 'rendering', 'construction', 'design', 'permit', 'specifications', 'site'],
  accountant: ['vat', 'ifrs', 'sap', 'excel', 'reconciliation', 'audit', 'payroll', 'forecast', 'tax', 'ledger', 'close', 'reporting'],
  engineer: ['autocad', 'cad', 'project', 'budget', 'schedule', 'site', 'quality', 'safety', 'hvac', 'plc', 'commissioning'],
  developer: ['javascript', 'typescript', 'react', 'node', 'python', 'api', 'sql', 'aws', 'docker', 'git', 'ci/cd', 'testing'],
  manager: ['budget', 'team', 'kpi', 'strategy', 'stakeholder', 'vendor', 'forecast', 'p&l', 'operations', 'planning', 'reporting'],
  analyst: ['sql', 'excel', 'dashboard', 'reporting', 'kpi', 'analysis', 'power bi', 'stakeholder', 'forecast', 'modeling'],
};

function roleFamily(headline?: string): string | null {
  const h = clean(headline).toLowerCase();
  if (!h) return null;
  for (const fam of Object.keys(ROLE_KEYWORDS)) if (h.includes(fam)) return fam;
  if (h.includes('account')) return 'accountant';
  if (h.includes('develop') || h.includes('software') || h.includes('programmer')) return 'developer';
  if (h.includes('engine')) return 'engineer';
  if (h.includes('analyst')) return 'analyst';
  if (h.includes('manager') || h.includes('lead') || h.includes('head')) return 'manager';
  if (h.includes('draft')) return 'draftsman';
  if (h.includes('architect')) return 'architect';
  return null;
}

// ----------------------------------------------------------------------------
// A. ATS PARSEABILITY — 30
// ----------------------------------------------------------------------------
function scoreParseability(p: Profile): { section: ScoreSection } {
  const criteria: ScoreFactor[] = [];
  // A1 layout safety — the app stores data as structured fields and exports a
  // single-column CV, so layout is safe by construction.
  criteria.push({ key: 'A1', label: 'Layout safety', earned: 8, max: 8, note: 'Structured profile → single-column export; no tables/text boxes.' });
  // A2 standard headings — our sections always use conventional labels.
  criteria.push({ key: 'A2', label: 'Standard section headings', earned: 5, max: 5, note: 'Summary, Experience, Education, Skills, Certifications all conventional.' });
  // A3 contact block parseability
  const phoneOk = has(p.phone);
  const cc = splitNamePhoneCountry(p.phone).hasCountryCode;
  const linkedin = (p.links ?? []).some((l) => /linkedin/i.test(l));
  let a3 = 0; const a3notes: string[] = [];
  if (has(p.fullName)) a3 += 1;
  if (phoneOk) a3 += 1;
  if (has(p.email)) a3 += 1;
  if (has(p.location)) a3 += 1;
  if (cc && linkedin) a3 += 0; // both are bonuses, not part of the 4 base
  if (!has(p.fullName)) a3notes.push('name missing');
  if (!phoneOk) a3notes.push('phone missing');
  if (!has(p.email)) a3notes.push('email missing');
  if (!has(p.location)) a3notes.push('location missing');
  // base 4 if all four present, else proportional
  const base4 = (has(p.fullName) ? 1 : 0) + (phoneOk ? 1 : 0) + (has(p.email) ? 1 : 0) + (has(p.location) ? 1 : 0);
  a3 = base4 === 4 ? 4 : base4 >= 3 ? 2 : 0;
  if (cc && !linkedin) a3notes.push('add LinkedIn URL');
  criteria.push({ key: 'A3', label: 'Contact block parseable', earned: a3, max: 4, note: a3notes.length ? a3notes.join('; ') : 'name, phone, email, city as plain text' });
  // A4 date format consistency
  const expDates = (p.experience ?? []).map((e) => ({ s: clean(e.startDate), en: clean(e.endDate) }));
  const allHaveMonthYear = expDates.length > 0 && expDates.every((d) => /\d{4}/.test(d.s) && (/\d{4}/.test(d.en) || /present|current|now/i.test(d.en)));
  const a4 = expDates.length === 0 ? 0 : allHaveMonthYear ? 5 : 2.5;
  criteria.push({ key: 'A4', label: 'Date format consistency', earned: a4, max: 5, note: a4 === 5 ? 'Every role has start + end year (or Present)' : a4 === 0 ? 'No experience dates' : 'Some roles miss dates / mixed format' });
  // A5 character & font safety
  const haystack = [p.summary, ...(p.experience ?? []).map((e) => e.description ?? ''), ...(p.skills ?? [])].join(' ');
  const emoji = EMOJI_RE.test(haystack);
  const a5 = emoji ? 2 : 4;
  criteria.push({ key: 'A5', label: 'Character & font safety', earned: a5, max: 4, note: a5 === 4 ? 'Standard text + bullets only' : 'Emoji/decorative glyphs detected' });
  // A6 keyword extractability — skills appear as a list AND in experience prose
  const expText = (p.experience ?? []).map((e) => e.description ?? '').join(' ').toLowerCase();
  const skillsInExp = (p.skills ?? []).filter((s) => expText.includes(s.toLowerCase())).length;
  let a6 = 0;
  if ((p.skills ?? []).length >= 4 && skillsInExp >= 2) a6 = 4;
  else if ((p.skills ?? []).length >= 1) a6 = 2;
  criteria.push({ key: 'A6', label: 'Keyword extractability', earned: a6, max: 4, note: a6 === 4 ? `${skillsInExp} skills echoed in experience` : a6 === 2 ? 'skills listed but rarely in experience' : 'no skills section' });

  const earned = criteria.reduce((s, c) => s + c.earned, 0);
  return { section: { id: 'A', label: 'ATS parseability', earned, max: 30, criteria } };
}

// ----------------------------------------------------------------------------
// B. SECTION COMPLETENESS — 20
// ----------------------------------------------------------------------------
function scoreCompleteness(p: Profile): { section: ScoreSection; degree?: string } {
  const criteria: ScoreFactor[] = [];
  // B1 summary
  const s = clean(p.summary);
  const cliche = /results-driven|team player|self-motivated|go-getter|hardworking/i.test(s);
  let b1 = 0; const b1n: string[] = [];
  if (!s) b1n.push('absent');
  else if (s.length >= 90 && s.length <= 600 && !cliche) { b1 = 4; }
  else if (s.length > 0) { b1 = 2; b1n.push(s.length > 600 ? 'too long' : s.length < 90 ? 'too short' : cliche ? 'cliché-led' : 'generic'); }
  criteria.push({ key: 'B1', label: 'Professional summary', earned: b1, max: 4, note: b1 === 4 ? '3–5 lines, role + experience + differentiator' : b1n.join('; ') || 'generic' });
  // B2 experience structure
  const exps = (p.experience ?? []).filter((e) => has(e.title));
  let b2 = 0; const b2n: string[] = [];
  if (exps.length === 0) b2n.push('no roles');
  else {
    const incomplete = exps.filter((e) => !has(e.company) || !has(e.startDate) || bulletsOf(e.description).length === 0).length;
    if (incomplete === 0) b2 = 6;
    else if (incomplete === 1) { b2 = 3; b2n.push('one role missing element'); }
    else { b2n.push(`${incomplete} roles incomplete`); }
    const counts = exps.map((e) => bulletsOf(e.description).length);
    if (counts.length > 1 && (Math.max(...counts) - Math.min(...counts) > 8)) b2n.push('uneven bullet counts');
  }
  criteria.push({ key: 'B2', label: 'Work experience structure', earned: b2, max: 6, note: b2 === 6 ? 'Every role: title, company, dates, 3–6 bullets' : b2n.join('; ') || 'incomplete' });
  // B3 skills section
  const sk = (p.skills ?? []).map(clean).filter(Boolean);
  const filler = sk.filter((s) => FILLER_SKILLS.has(s.toLowerCase())).length;
  let b3 = 0; const b3n: string[] = [];
  if (sk.length === 0) b3n.push('absent');
  else if (sk.length >= 8 && sk.length <= 20 && filler === 0) b3 = 4;
  else { b3 = 2; if (sk.length > 25) b3n.push('bloated'); if (filler > 0) b3n.push('filler present'); if (sk.length < 8) b3n.push('thin'); if (sk.length >= 8 && sk.length <= 20 && filler > 0) b3n.push('filler'); }
  criteria.push({ key: 'B3', label: 'Skills section', earned: b3, max: 4, note: b3 === 4 ? `${sk.length} skills, no self-ratings` : b3n.join('; ') || 'unbalanced' });
  // B4 education & certifications
  const edu = any(p.education);
  const certs = any(p.certifications);
  let b4 = 0; const b4n: string[] = [];
  if (edu && certs) b4 = 4;
  else if (edu || certs) { b4 = 2; b4n.push(edu ? 'certs missing years/body' : 'education missing'); }
  else b4n.push('both absent');
  criteria.push({ key: 'B4', label: 'Education & certifications', earned: b4, max: 4, note: b4 === 4 ? 'Degrees + certs with bodies' : b4n.join('; ') });
  // B5 region-appropriate extras (UAE/GCC norms: languages expected, photo ok)
  const langs = any(p.languages);
  let b5 = langs ? 2 : 1;
  criteria.push({ key: 'B5', label: 'Region-appropriate extras (UAE)', earned: b5, max: 2, note: b5 === 2 ? 'Languages listed (GCC norm)' : 'Add languages for GCC norm' });

  const earned = criteria.reduce((s, c) => s + c.earned, 0);
  return { section: { id: 'B', label: 'Section completeness', earned, max: 20, criteria } };
}

// ----------------------------------------------------------------------------
// C. CONTENT STRENGTH — 35
// ----------------------------------------------------------------------------
function scoreContent(p: Profile): { section: ScoreSection } {
  const criteria: ScoreFactor[] = [];
  const exps = (p.experience ?? []).filter((e) => has(e.description));
  const recent = exps.slice(0, 2);
  const recentBullets = recent.flatMap((e) => bulletsOf(e.description));
  const quantified = recentBullets.filter((b) => countMetric(b) > 0).length;
  const ratio = recentBullets.length ? quantified / recentBullets.length : 0;
  let c1 = 0;
  if (ratio >= 0.5) c1 = 10; else if (ratio >= 0.25) c1 = 5; else c1 = 0;
  criteria.push({ key: 'C1', label: 'Quantified achievements', earned: c1, max: 10, note: `${quantified}/${recentBullets.length} recent bullets quantified (≥50%→10)` });
  // C2 achievement vs duty framing
  const duty = recentBullets.filter((b) => DUTY_FRAMING.some((d) => b.toLowerCase().startsWith(d))).length;
  let c2 = 0;
  if (duty === 0 && recentBullets.length > 0) c2 = 6;
  else if (duty <= 3) c2 = 3;
  criteria.push({ key: 'C2', label: 'Achievement vs duty framing', earned: c2, max: 6, note: c2 === 6 ? 'Action-led, outcome-focused' : `${duty} duty-framed bullet(s)` });
  // C3 scope indicators
  const scopeText = [p.summary, ...(p.experience ?? []).map((e) => e.description ?? '')].join(' ').toLowerCase();
  const scopeHits = SCOPE_SIGNALS.filter((s) => scopeText.includes(s)).length;
  let c3 = 0;
  if (scopeHits >= 3) c3 = 6; else if (scopeHits >= 1) c3 = 3;
  criteria.push({ key: 'C3', label: 'Scope indicators', earned: c3, max: 6, note: `${scopeHits} scope signals (budget/team/revenue/region…)` });
  // C4 career narrative — progression (rising titles / no long gaps)
  let c4 = 0; const c4n: string[] = [];
  if (exps.length >= 2) {
    // crude progression: later roles have "senior"/"lead"/"manager" or longer tenure
    const hasProgression = exps.some((e) => /senior|lead|manager|head|principal|chief/i.test(e.title ?? ''));
    c4 = hasProgression ? 5 : 2.5; if (!hasProgression) c4n.push('no rising-title signal');
  } else if (exps.length === 1) { c4 = 2.5; c4n.push('single role'); }
  else c4n.push('no history');
  criteria.push({ key: 'C4', label: 'Career narrative', earned: c4, max: 5, note: c4 === 5 ? 'Legible progression' : c4n.join('; ') || 'flat but coherent' });
  // C5 seniority calibration — default mid; altitude check
  let c5 = 2; // partial: most imported CVs are mid-level with task bullets; resolve downward per determinism rule
  const senior = /senior|lead|manager|head|principal|chief|director/i.test(p.headline ?? '');
  const taskHeavy = recentBullets.length > 0 && recentBullets.filter((b) => ACTION_VERBS.has(b.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') || '')).length / recentBullets.length < 0.3;
  if (senior && taskHeavy) c5 = 0; else if (senior && !taskHeavy) c5 = 4; else if (!senior && !taskHeavy) c5 = 4;
  criteria.push({ key: 'C5', label: 'Seniority calibration', earned: c5, max: 4, note: senior ? (taskHeavy ? 'senior title but task-level bullets' : 'altitude matches') : (taskHeavy ? 'mid title, task-level (ok)' : 'altitude matches') });
  // C6 length & density (proxy: total content volume vs norm)
  const totalBullets = (p.experience ?? []).flatMap((e) => bulletsOf(e.description)).length;
  const totalChars = [p.summary, ...(p.experience ?? []).map((e) => e.description ?? '')].join('').length;
  let c6 = 4;
  if (totalBullets < 4 || totalChars < 300) c6 = 2;
  else if (totalChars > 6000) c6 = 2;
  criteria.push({ key: 'C6', label: 'Length & density', earned: c6, max: 4, note: c6 === 4 ? 'Within norm, no filler' : totalBullets < 4 ? 'too thin' : 'over-long / filler' });

  const earned = criteria.reduce((s, c) => s + c.earned, 0);
  return { section: { id: 'C', label: 'Content strength', earned, max: 35, criteria } };
}

// ----------------------------------------------------------------------------
// D. TARGETING & KEYWORDS — 15 (ROLE_ONLY / UNTARGETED_85)
// ----------------------------------------------------------------------------
function scoreTargeting(p: Profile): { section: ScoreSection; mode: ScoreMode; keywordSet: string[] } {
  const fam = roleFamily(p.headline);
  if (!fam) {
    // UNTARGETED_85
    return { section: { id: 'D', label: 'Targeting (unscored)', earned: 0, max: 0, criteria: [{ key: 'D1', label: 'Targeting unscored', earned: 0, max: 0, note: 'No target role — section excluded; score normalized from /85' }] }, mode: 'UNTARGETED_85', keywordSet: [] };
  }
  const kw = ROLE_KEYWORDS[fam];
  const skillText = (p.skills ?? []).map((s) => s.toLowerCase()).join(', ');
  const prose = [p.summary, ...(p.experience ?? []).map((e) => e.description ?? '')].join(' ').toLowerCase();
  const present = kw.filter((k) => skillText.includes(k) || prose.includes(k));
  let d1 = 0;
  if (present.length >= 8) d1 = 8; else if (present.length >= 5) d1 = 4;
  const d2 = 4; // it's the user's own role, so alignment is exact
  const ctxSignals = ['gcc', 'uae', 'dubai', 'team', 'budget', 'multi-site', 'project', 'client', 'vendor', 'itil', 'agile', 'retail', 'construction', 'healthcare'];
  const ctxHits = ctxSignals.filter((s) => prose.includes(s)).length;
  let d3 = 0;
  if (ctxHits >= 3) d3 = 3; else if (ctxHits >= 1) d3 = 1.5;
  const criteria: ScoreFactor[] = [
    { key: 'D1', label: 'Hard-skill match', earned: d1, max: 8, note: `${present.length}/10 role keywords present` },
    { key: 'D2', label: 'Title alignment', earned: d2, max: 4, note: 'CV role matches target role' },
    { key: 'D3', label: 'Contextual echo', earned: d3, max: 3, note: `${ctxHits} JD/role context signals` },
  ];
  const earned = criteria.reduce((s, c) => s + c.earned, 0);
  return { section: { id: 'D', label: 'Targeting & keywords', earned, max: 15, criteria }, mode: 'ROLE_ONLY', keywordSet: kw };
}

// ----------------------------------------------------------------------------
// aggregate
// ----------------------------------------------------------------------------
export function analyzeProfile(p: Profile): ProfileAnalysis {
  const A = scoreParseability(p);
  const B = scoreCompleteness(p);
  const C = scoreContent(p);
  const D = scoreTargeting(p);

  const sections = [A.section, B.section, C.section, D.section];
  const subtotals = {
    parseability: A.section.earned,
    completeness: B.section.earned,
    content: C.section.earned,
    targeting: D.section.earned,
  };

  let rawTotal = A.section.earned + B.section.earned + C.section.earned + D.section.earned;
  let score = rawTotal;
  let mode = D.mode;
  if (mode === 'UNTARGETED_85') {
    const raw85 = A.section.earned + B.section.earned + C.section.earned; // out of 85
    score = Math.round((raw85 / 85) * 100);
  }

  const gradeBand =
    score >= 90 ? 'Interview-ready' :
    score >= 80 ? 'Strong — minor fixes' :
    score >= 65 ? 'Competitive risk — targeted rework' :
    score >= 50 ? 'Major rework' : 'Rebuild recommended';

  const factors = sections.flatMap((s) => s.criteria);

  // suggestions
  const suggestions: Suggestion[] = [];
  const addS = (title: string, detail: string, section: ProfileSection) => suggestions.push({ title, detail, section });
  if (A.section.criteria.find((c) => c.key === 'A3')!.earned < 4) addS('Complete your contact block', 'Put name, phone (with country code), email and city as plain text at the top; add your LinkedIn URL.', 'basics');
  if (B.section.criteria.find((c) => c.key === 'B1')!.earned < 4) addS('Strengthen your summary', 'Write 3–5 lines: role, years, domain, one differentiator — no clichés.', 'basics');
  if (B.section.criteria.find((c) => c.key === 'B2')!.earned < 6) addS('Fix experience structure', 'Every role needs title, company, dates and 3–6 bullets.', 'experience');
  if (B.section.criteria.find((c) => c.key === 'B3')!.earned < 4) addS('Balance your skills', 'List 8–20 relevant skills, no filler ("MS Word") or self-ratings.', 'basics');
  if (B.section.criteria.find((c) => c.key === 'B4')!.earned < 4) addS('Add education & certifications', 'Degrees with institution/year and certs with issuing body lift credibility.', 'certifications');
  if (C.section.criteria.find((c) => c.key === 'C1')!.earned < 10) addS('Quantify your impact', 'Add numbers (% , $ , x) to at least half your recent bullets — e.g. "cut rework 18%".', 'experience');
  if (C.section.criteria.find((c) => c.key === 'C2')!.earned < 6) addS('Lead bullets with action verbs', 'Avoid "Responsible for" / "Duties included" — start with Led, Built, Cut.', 'experience');
  if (C.section.criteria.find((c) => c.key === 'C3')!.earned < 6) addS('Show scope', 'Mention budget, team size, users, region or revenue influenced.', 'experience');
  if (D.mode === 'ROLE_ONLY' && D.section.criteria.find((c) => c.key === 'D1')!.earned < 8) addS('Mirror role keywords', `Echo the top skills for your role (${D.keywordSet.slice(0, 5).join(', ')}) in skills + experience.`, 'basics');

  return {
    score,
    sections,
    subtotals,
    mode,
    keywordSet: D.keywordSet,
    gradeBand,
    factors,
    completeness: A.section.earned + B.section.earned,
    quality: C.section.earned,
    suggestions,
  };
}
