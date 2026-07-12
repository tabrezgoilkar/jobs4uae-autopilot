import { describe, it, expect } from 'vitest';
import { analyzeProfile } from './profileStrength';

describe('analyzeProfile — honest score', () => {
  it('a bare-bones CV (the reported "91% basic" case) no longer scores ~91', () => {
    const basic = {
      fullName: 'Jane Doe', headline: 'Accountant', email: 'j@x.com', phone: '050', location: 'Dubai, UAE',
      summary: 'Accountant with some experience.', // ~33 chars, no metric
      skills: ['Excel', 'SAP', 'VAT', 'IFRS', 'Word'], // 5 skills
      experience: [{ title: 'Accountant', company: 'ACME', startDate: '2019', endDate: '2022', description: 'Did accounting tasks.' }], // 1 vague bullet
      education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting', year: '2012' }],
    };
    const a = analyzeProfile(basic as any);
    // Old logic would give 91%. New logic must be materially lower because the
    // quality dimension penalises the vague, metric-free, single-bullet content.
    expect(a.score).toBeLessThan(80);
    expect(a.completeness).toBeGreaterThanOrEqual(40); // most sections present
    expect(a.quality).toBeLessThan(40); // weak content
  });

  it('a strong, quantified CV scores high on both dimensions', () => {
    const strong = {
      fullName: 'Aisha Rahman', headline: 'Senior Accountant', email: 'a@x.com', phone: '+97150', location: 'Dubai, UAE',
      summary: 'Finance leader with 8 years across the GCC; cut close time 30% and saved $1.2M.',
      skills: ['Excel', 'SAP', 'VAT', 'IFRS', 'Forecasting', 'Power BI', 'Audit'],
      experience: [
        { title: 'Senior Accountant', company: 'ACME', startDate: '2019', endDate: 'Present', description: '- Led the monthly close\n- Cut close time 30%\n- Saved $1.2M via automation' },
        { title: 'Accountant', company: 'X', startDate: '2015', endDate: '2019', description: '- Built the VAT reporting process\n- Improved accuracy 25%' },
      ],
      education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting', year: '2012' }],
      projects: [{ name: 'Billing revamp', description: 'Reduced churn 20%', tech: ['SQL'] }],
      certifications: [{ name: 'CPA', issuer: 'AICPA', year: '2015' }],
      languages: [{ name: 'Arabic', level: 'Fluent' }],
      awards: [{ title: 'Employee of year', issuer: 'ACME', year: '2021', description: 'Top performer' }],
    };
    const a = analyzeProfile(strong as any);
    expect(a.score).toBeGreaterThanOrEqual(85);
    expect(a.quality).toBeGreaterThan(40);
  });

  it('returns a transparent factor breakdown', () => {
    const a = analyzeProfile({ fullName: 'X' } as any);
    expect(a.factors.length).toBeGreaterThan(5);
    const total = a.factors.reduce((s, f) => s + f.earned, 0);
    expect(total).toBe(a.score); // factors explain the whole score
  });
});
