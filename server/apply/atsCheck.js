// Honest ATS check — what an Applicant Tracking System actually does when it
// ingests a resume: parse standard sections, extract keyword hits, and flag
// formatting that breaks parsers. It does NOT invent a "match %". The point is
// transparency: show the candidate exactly which required keywords are present
// vs missing and whether the document is parser-safe. (Real ATS vendors sell
// fake "98% match" scores; we refuse to.)

const SECTION_RE = /^\s*(#{1,6}\s*|[*_]{0,2})\s*(contact|summary|profile|experience|work\s*experience|employment|education|skills|projects|certifications?|languages?|interests?)\s*[:\s]*$/im;

function norm(s) {
  return (s || '').toLowerCase().replace(/[’']/g, "'");
}

function extractSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (SECTION_RE.test(line)) {
      const name = line.replace(/[#*_:\s]/g, '').trim();
      current = { name, text: '' };
      sections.push(current);
    } else if (current) {
      current.text += line + '\n';
    }
  }
  return sections.map((s) => ({ name: s.name, text: s.text.trim() }));
}

const KNOWN_SECTIONS = ['summary', 'experience', 'education', 'skills'];

// Same keyword lexicon the fit-scorer uses, so "missing keywords" is consistent.
const LEXICON = [
  'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'node.js', 'python', 'java',
  'go', 'golang', 'rust', 'c++', 'c#', 'php', 'ruby', 'kotlin', 'swift', 'sql', 'postgres',
  'postgresql', 'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
  'terraform', 'ci/cd', 'graphql', 'rest', 'microservices', 'machine learning', 'ml', 'ai',
  'data engineering', 'etl', 'tableau', 'power bi', 'excel', 'agile', 'scrum', 'leadership',
  'communication', 'project management', 'ux', 'ui', 'figma', 'html', 'css', 'tailwind',
  'spring', 'django', 'flask', 'fastapi', 'express', 'next.js', 'nuxt', 'salesforce',
  'sap', 'oracle', 'kafka', 'spark', 'hadoop', 'pandas', 'numpy', 'tensorflow', 'pytorch',
];

function jobKeywords(jobText) {
  const t = norm(jobText);
  return LEXICON.filter((kw) => {
    const re = new RegExp(`(?:^|[^a-z0-9+])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9+]|$)`);
    return re.test(t);
  });
}

/**
 * @param {{resumeMarkdown:string, jobText:string}} opts
 * @returns {{sections:Array, presentKeywords:string[], missingKeywords:string[], atsReadable:boolean, warnings:string[]}}
 */
export function runAtsCheck({ resumeMarkdown, jobText }) {
  const sections = extractSections(resumeMarkdown || '');
  const sectionNames = sections.map((s) => norm(s.name));
  const resumeText = norm(resumeMarkdown || '');

  const keywords = jobKeywords(jobText || '');
  const presentKeywords = keywords.filter((k) => resumeText.includes(k));
  const missingKeywords = keywords.filter((k) => !resumeText.includes(k));

  const warnings = [];
  const missingCore = KNOWN_SECTIONS.filter((s) => !sectionNames.some((n) => n.includes(s)));
  if (missingCore.length) warnings.push(`Missing standard section(s): ${missingCore.join(', ')}.`);
  // Contact block: an email/phone/url near the top, even without a heading.
  const hasContact = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)/i.test(resumeMarkdown || '');
  if (!sectionNames.some((n) => n.includes('contact')) && !hasContact) {
    warnings.push('No clear contact/header block (name + email/phone) detected.');
  }
  // Markdown tables break many ATS parsers (they expect plain text/headings).
  if (/^\s*\|.*\|\s*$/m.test(resumeMarkdown || '')) {
    warnings.push('Contains Markdown tables — many ATS parsers drop or misread them; use bullet lists instead.');
  }
  if (missingKeywords.length) warnings.push(`${missingKeywords.length} required keyword(s) from the posting are absent.`);

  const atsReadable = missingCore.length === 0 && hasContact && !/^\s*\|.*\|\s*$/m.test(resumeMarkdown || '');

  return {
    sections: sections.map((s) => s.name),
    presentKeywords,
    missingKeywords,
    atsReadable,
    warnings,
  };
}
