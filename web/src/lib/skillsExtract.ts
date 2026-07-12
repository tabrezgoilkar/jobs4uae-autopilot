import type { Profile } from '../api';

// Deterministic, client-side skill extraction — no AI, no network.
// Scans the profile's free text and suggests skills that are NOT already listed.

const DICTIONARY: string[] = [
  // Architecture / drafting / construction (GCC-heavy)
  'Autocad', 'Revit', 'Navisworks', 'BIM', 'Rhino', 'SketchUp', '3ds Max', 'ETABS',
  'SAP2000', 'STAAD Pro', 'Bar Bending Schedule', 'Bill of Quantities', 'GFC Drawings',
  'Shop Drawings', 'Facade', 'MEP', 'Quantity Surveying', 'Primavera P6', 'MS Project',
  'Construction Management', 'Site Supervision', 'V-Ray', 'Lumion', 'Tekla',
  // IT / software
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java',
  'C#', 'PHP', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Terraform', 'CI/CD', 'Git', 'Linux', 'REST API', 'GraphQL',
  'Next.js', 'NestJS', 'Django', 'Flask', 'Spring Boot', 'HTML', 'CSS', 'Tailwind',
  // Finance / accounting
  'VAT', 'IFRS', 'SAP FICO', 'Tally', 'QuickBooks', 'Zoho Books', 'Financial Reporting',
  'Accounts Payable', 'Accounts Receivable', 'Payroll', 'Reconciliation', 'Audit',
  'Tax Compliance', 'Budgeting', 'Forecasting', 'Cost Control', 'Excel', 'Power BI',
  // Engineering
  'HVAC', 'PLC', 'SCADA', 'AutoCAD Electrical', 'Pressure Vessels', 'Piping', 'NDT',
  'Commissioning', 'Maintenance', 'Lean', 'Six Sigma', 'Kaizen',
  // Soft / cross-functional
  'Project Management', 'Stakeholder Management', 'Team Leadership', 'Vendor Management',
  'Procurement', 'Contract Management', 'Negotiation', 'Agile', 'Scrum',
  'Customer Relationship Management', 'CRM', 'Salesforce', 'Reporting', 'Training',
  'Arabic', 'English', 'Hindi', 'Urdu', 'French',
];

// token patterns that are not in the dictionary but commonly appear as skills
const TOKEN_PATTERNS: RegExp[] = [
  /\b(?:ms)?\s*office\b/i,
  /\b(?:adobe|photoshop|illustrator|indesign|premiere)\b/i,
  /\b(?:opencv|tensorflow|pytorch|scikit[- ]?learn|pandas|numpy)\b/i,
  /\b(?:kubernetes|helm|jenkins|github actions|gitlab ci)\b/i,
];

function collectText(p: Profile): string {
  const parts: string[] = [p.summary ?? ''];
  for (const e of p.experience ?? []) parts.push(e.title ?? '', e.company ?? '', e.description ?? '');
  for (const pr of p.projects ?? []) parts.push(pr.name ?? '', pr.description ?? '');
  for (const a of p.awards ?? []) parts.push(a.title ?? '', a.description ?? '');
  return parts.join('\n').toLowerCase();
}

function normalizeSkill(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function extractSkills(profile: Profile): string[] {
  const text = collectText(profile);
  const have = new Set((profile.skills ?? []).map((s) => s.toLowerCase()));
  const found = new Set<string>();

  for (const raw of DICTIONARY) {
    const s = normalizeSkill(raw);
    const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text) && !have.has(s.toLowerCase())) found.add(s);
  }
  for (const re of TOKEN_PATTERNS) {
    const m = text.match(re);
    if (m && !have.has(m[0].toLowerCase())) found.add(normalizeSkill(m[0]));
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}
