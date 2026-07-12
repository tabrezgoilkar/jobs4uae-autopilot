import { describe, it, expect } from 'vitest';
import { analyzeProfile } from './profileStrength';

describe('analyzeProfile — ATS rubric (100-pt)', () => {
  const basic = {
    fullName: 'FAHAD SAIN', headline: 'Architectural Draftsman', email: 'f@x.com', phone: '+97150', location: 'Dubai, UAE',
    summary: 'Architectural Draftsman with experience in 2D/3D drawings and BIM modeling across residential and commercial projects.',
    skills: ['AUTOCAD', 'REVIT', 'NAVISWORK', 'RHINO', 'EXCEL', 'SKETCHUP'],
    experience: [{ title: 'Architectural Draftsman', company: 'C&B LLC', startDate: 'Aug 2023', endDate: 'Present', description: '- Creating Floor Layout.\n- Finalizing Flooring layout.\n- Preparing GFC drawings.' }],
    education: [{ institution: 'MSBTE', degree: 'Diploma', field: 'Civil Engineering' }],
    links: ['https://linkedin.com/in/fahad'],
  };

  it('a basic CV cannot hit 100 — it lands in the competitive-risk band', () => {
    const a = analyzeProfile(basic as any);
    expect(a.score).toBeLessThan(80);
    expect(a.gradeBand).not.toBe('Interview-ready');
    // every point is accounted for by the four rubric sections
    const sectionSum = a.sections.reduce((s, x) => s + x.earned, 0);
    expect(sectionSum).toBe(a.completeness + a.quality + (a.subtotals.targeting || 0));
  });

  it('a basic CV scores 0 on quantified achievements (C1) — the core gap', () => {
    const a = analyzeProfile(basic as any);
    const c1 = a.sections.find((s) => s.id === 'C')!.criteria.find((c) => c.key === 'C1')!;
    expect(c1.earned).toBe(0);
  });

  it('missing certifications costs the education/cert completeness point (B4)', () => {
    const noCert = analyzeProfile({ ...basic, certifications: [] } as any);
    const b4 = noCert.sections.find((s) => s.id === 'B')!.criteria.find((c) => c.key === 'B4')!;
    expect(b4.earned).toBeLessThan(4);
  });

  it('a strong, quantified, complete CV reaches the top band', () => {
    const strong = {
      fullName: 'Aisha Rahman', headline: 'Senior Accountant', email: 'a@x.com', phone: '+97150', location: 'Dubai, UAE',
      summary: 'Finance leader with 8 years across the GCC; cut close time 30% and saved $1.2M for a team of 12.',
      skills: ['VAT', 'IFRS', 'SAP', 'Excel', 'Forecasting', 'Power BI', 'Audit', 'Reconciliation', 'Payroll', 'Tax', 'Ledger', 'Reporting'],
      experience: [
        { title: 'Senior Accountant', company: 'ACME', startDate: 'Jan 2019', endDate: 'Present', description: '- Led the monthly close for a team of 12\n- Cut close time 30%\n- Saved $1.2M via automation across GCC' },
        { title: 'Accountant', company: 'X', startDate: 'Jan 2015', endDate: 'Dec 2018', description: '- Built the VAT reporting process\n- Improved accuracy 25%' },
      ],
      education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting', year: '2012' }],
      certifications: [{ name: 'CPA', issuer: 'AICPA', year: '2015' }],
      languages: [{ name: 'Arabic' }],
      awards: [{ title: 'Employee of year' }],
      links: ['https://linkedin.com/in/aisha'],
    };
    const a = analyzeProfile(strong as any);
    expect(a.score).toBeGreaterThanOrEqual(85);
    expect(a.gradeBand).toBe('Interview-ready');
  });

  it('runs deterministically — same input, same score', () => {
    const a1 = analyzeProfile(basic as any);
    const a2 = analyzeProfile(basic as any);
    expect(a1.score).toBe(a2.score);
    expect(JSON.stringify(a1.sections)).toBe(JSON.stringify(a2.sections));
  });

  it('factors (flat) sum to the reported score', () => {
    const a = analyzeProfile(basic as any);
    expect(a.factors.reduce((s, f) => s + f.earned, 0)).toBe(a.score);
  });
});
