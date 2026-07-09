// Deterministic, no-AI job-fit scoring — the 5-dimension framework ported from
// MadsLorentzen/ai-job-search (see docs/RESEARCH-ai-job-search.md), adapted to
// our profile schema. Pure + fast: run it instantly on paste, no AI setup, no
// tokens. It complements the AI evaluation (which is the "why"); this is the
// transparent, always-available "what's the number and where does it come from".
//
// Five dimensions, each 0–100, combined with the weights below (sum 100):
//   1. Technical Skills Match      30%
//   2. Experience Match            25%
//   3. Behavioral / Culture Fit    15%
//   4. Location & Logistics        Pass/Fail deal-breaker
//   5. Career Alignment & Motiv.   30%
//
// Verdict thresholds: Strong ≥75, Good 60–74, Moderate 45–59, Weak 30–44, Poor <30.
// A location deal-breaker forces verdict ≤ Weak and flags it.

const WEIGHTS = {
  skills: 0.3,
  experience: 0.25,
  behavioral: 0.15,
  career: 0.3,
};

const VERDICTS = [
  { min: 75, label: 'Strong' },
  { min: 60, label: 'Good' },
  { min: 45, label: 'Moderate' },
  { min: 30, label: 'Weak' },
  { min: 0, label: 'Poor' },
];

function verdictFor(score) {
  return VERDICTS.find((v) => score >= v.min)?.label ?? 'Poor';
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[’']/g, "'");
}

function tokenize(s) {
  return norm(s).split(/[^a-z0-9+#.]+/).filter(Boolean);
}

// Common tech/skill keywords to look for in a posting when the profile doesn't
// name them — used to estimate "required skills you don't have".
const SKILL_LEXICON = [
  'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'node.js', 'python', 'java',
  'go', 'golang', 'rust', 'c++', 'c#', 'php', 'ruby', 'kotlin', 'swift', 'sql', 'postgres',
  'postgresql', 'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
  'terraform', 'ci/cd', 'graphql', 'rest', 'microservices', 'machine learning', 'ml', 'ai',
  'data engineering', 'etl', 'tableau', 'power bi', 'excel', 'agile', 'scrum', 'leadership',
  'communication', 'project management', 'ux', 'ui', 'figma', 'html', 'css', 'tailwind',
  'spring', 'django', 'flask', 'fastapi', 'express', 'next.js', 'nuxt', 'salesforce',
  'sap', 'oracle', 'kafka', 'spark', 'hadoop', 'pandas', 'numpy', 'tensorflow', 'pytorch',
];

function extractSkillsFromText(text) {
  const t = norm(text);
  const found = new Set();
  for (const skill of SKILL_LEXICON) {
    // word-boundary-ish: escape regex and require a boundary on both sides
    const re = new RegExp(`(?:^|[^a-z0-9+])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9+]|$)`);
    if (re.test(t)) found.add(skill);
  }
  return [...found];
}

function overlap(a, b) {
  const setB = new Set(b.map(norm));
  return a.filter((x) => setB.has(norm(x)));
}

function skillMatchDimension(profileSkills, jobText) {
  const profile = (profileSkills || []).map(norm).filter(Boolean);
  const jobSkills = extractSkillsFromText(jobText);
  if (!jobSkills.length) {
    return { score: 60, matched: [], missing: [], comment: 'No clear technical requirements detected — neutral.' };
  }
  const matched = jobSkills.filter((s) => profile.includes(s));
  const missing = jobSkills.filter((s) => !profile.includes(s));
  const ratio = matched.length / jobSkills.length;
  // Weight: full credit only when most required skills are present.
  const score = Math.round(20 + 80 * ratio);
  return {
    score,
    matched,
    missing,
    comment: matched.length
      ? `Matches ${matched.length}/${jobSkills.length} detected requirements.`
      : `None of the ${jobSkills.length} detected requirements are in your profile.`,
  };
}

function experienceDimension(profile, jobText) {
  const years = (profile.experience || []).reduce((acc, e) => {
    const start = parseInt(String(e.startDate || '').slice(0, 4), 10);
    const end = e.endDate && e.endDate !== 'Present' ? parseInt(String(e.endDate).slice(0, 4), 10) : new Date().getFullYear();
    if (start && end && end >= start) acc += Math.min(40, end - start + 1);
    return acc;
  }, 0);

  // Detect required years in the posting.
  const reqMatch = norm(jobText).match(/(\d+)\+?\s*(?:–|-|to)?\s*\d*\s*years?/);
  const required = reqMatch ? parseInt(reqMatch[1], 10) : null;

  let score;
  if (required == null) {
    score = 70; // no explicit requirement
  } else if (years >= required) {
    score = 100;
  } else if (years >= required * 0.6) {
    score = 65;
  } else {
    score = 35;
  }
  return {
    score,
    years,
    required,
    comment: required == null
      ? `No explicit experience requirement; you have ~${years}y.`
      : `Role wants ${required}y; profile shows ~${years}y.`,
  };
}

function behavioralDimension(profile, jobText) {
  const t = norm(jobText);
  let score = 70; // baseline
  const signals = [];
  if (/remote/.test(t)) { score += 10; signals.push('remote-friendly'); }
  if (/hybrid/.test(t)) { score += 5; signals.push('hybrid'); }
  if (/(senior|lead|principal|staff)/.test(t)) { score -= 5; signals.push('seniority-heavy'); }
  if (/(junior|graduate|entry|intern)/.test(t)) { score += 5; signals.push('entry-friendly'); }
  if (/(fast-paced|agile|collaborat|team)/.test(t)) { score += 5; signals.push('culture keywords present'); }
  return { score: Math.max(0, Math.min(100, score)), signals, comment: signals.length ? signals.join(', ') : 'No strong behavioral signals.' };
}

function locationDimension(profile, jobText) {
  const t = norm(jobText);
  // Deal-breaker: the JOB is abroad + explicitly requires on-site relocation.
  // Note: we check the UAE mention against the JOB TEXT only — the candidate's
  // own location must NOT rescue an abroad posting.
  const requiresRelocation = /relocation|on-site only|onsite only|must be based in/.test(t);
  const jobMentionsUae = /(uae|dubai|abu dhabi|united arab emirates|gulf)/.test(t);
  const jobAbroad = /(us|uk|usa|united states|london|germany|france|canada)/.test(t);
  const dealBreaker = requiresRelocation && !jobMentionsUae && jobAbroad;
  return {
    score: dealBreaker ? 0 : 100,
    dealBreaker,
    comment: dealBreaker
      ? 'Role requires on-site relocation abroad — likely a deal-breaker.'
      : 'Location/logistics acceptable (remote or local).',
  };
}

function careerDimension(profile, jobText) {
  const target = norm([profile.headline, profile.summary, ...(profile.experience || []).map((e) => e.title)].join(' '));
  const tokens = new Set(tokenize(target));
  const jobWords = tokenize(jobText).filter((w) => w.length > 3);
  const hit = jobWords.filter((w) => tokens.has(w));
  const ratio = jobWords.length ? hit.length / jobWords.length : 0;
  const score = Math.round(30 + 70 * Math.min(1, ratio * 3)); // amplify modest overlap
  return {
    score,
    overlapTerms: hit.slice(0, 8),
    comment: hit.length ? `Aligns with your profile on: ${hit.slice(0, 6).join(', ')}.` : 'Limited alignment with your stated career focus.',
  };
}

/**
 * @param {{jobText:string, profile:object}} opts
 * @returns {{score:number, verdict:string, dealBreaker:boolean, dimensions:Array}}
 */
export function scoreFit({ jobText, profile = {} } = {}) {
  if (!jobText || !jobText.trim()) {
    return { score: 0, verdict: 'Poor', dealBreaker: false, dimensions: [] };
  }

  const skills = skillMatchDimension(profile.skills, jobText);
  const experience = experienceDimension(profile, jobText);
  const behavioral = behavioralDimension(profile, jobText);
  const location = locationDimension(profile, jobText);
  const career = careerDimension(profile, jobText);

  const weighted =
    skills.score * WEIGHTS.skills +
    experience.score * WEIGHTS.experience +
    behavioral.score * WEIGHTS.behavioral +
    career.score * WEIGHTS.career;

  // Location is a hard gate, not averaged in.
  let score = Math.round(weighted);
  if (location.dealBreaker) score = Math.min(score, 25);

  const dimensions = [
    { name: 'Technical Skills Match', score: skills.score, weight: WEIGHTS.skills, comment: skills.comment },
    { name: 'Experience Match', score: experience.score, weight: WEIGHTS.experience, comment: experience.comment },
    { name: 'Behavioral / Culture Fit', score: behavioral.score, weight: WEIGHTS.behavioral, comment: behavioral.comment },
    { name: 'Location & Logistics', score: location.score, weight: 0, comment: location.comment },
    { name: 'Career Alignment', score: career.score, weight: WEIGHTS.career, comment: career.comment },
  ];

  return {
    score,
    verdict: verdictFor(score),
    dealBreaker: location.dealBreaker,
    dimensions,
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
  };
}
