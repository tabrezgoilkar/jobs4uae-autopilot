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
      // NOTE: no projects / certifications / awards / languages
    };
    const a = analyzeProfile(basic as any);
    // Old logic gave 91%. New logic must be materially lower because the content
    // is weak AND there is no credibility section (completeness caps at 45/60).
    expect(a.score).toBeLessThan(80);
    expect(a.completeness).toBeLessThan(60); // missing credibility section caps completeness
    expect(a.quality).toBeLessThan(40); // weak content
  });

  it('padding a basic CV with more plain bullets still cannot reach 100', () => {
    // Same basic shell but many bullet points and a long summary — no metrics,
    // no credibility sections. A real "very basic but looks filled" CV.
    const padded = {
      fullName: 'Jane Doe', headline: 'Accountant', email: 'j@x.com', phone: '050', location: 'Dubai, UAE',
      summary: 'x'.repeat(320),
      skills: ['Excel', 'SAP', 'VAT', 'IFRS', 'Word', 'PowerPoint'],
      experience: [
        { title: 'Accountant', company: 'ACME', description: Array.from({ length: 12 }, (_, i) => `- Task ${i} done`).join('\n') },
      ],
      education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting' }],
    };
    const a = analyzeProfile(padded as any);
    expect(a.score).toBeLessThan(80); // capped by missing credibility section
  });

  it('a CV strong on content but missing certs/awards caps below 85', () => {
    const strongNoCred = {
      fullName: 'Aisha', headline: 'Snr Accountant', email: 'a@x.com', phone: '+97150', location: 'Dubai, UAE',
      summary: 'Finance leader across the GCC; cut close time 30%.',
      skills: ['Excel', 'SAP', 'VAT', 'IFRS', 'Forecasting', 'Power BI'],
      experience: [{ title: 'Snr Accountant', company: 'ACME', description: '- Led the monthly close\n- Cut close time 30%\n- Saved $1.2M via automation' }],
      education: [{ institution: 'Uni', degree: 'BSc' }],
      projects: [{ name: 'Billing revamp' }],
      languages: [{ name: 'Arabic' }],
    };
    const a = analyzeProfile(strongNoCred as any);
    expect(a.completeness).toBeLessThan(60);
    expect(a.score).toBeLessThan(85);
  });

  it('a fully complete + quantified CV can reach the top band', () => {
    const strong = {
      fullName: 'Aisha Rahman', headline: 'Senior Accountant', email: 'a@x.com', phone: '+97150', location: 'Dubai, UAE',
      summary: 'Finance leader with 8 years across the GCC; cut close time 30% and saved $1.2M.',
      skills: ['Excel', 'SAP', 'VAT', 'IFRS', 'Forecasting', 'Power BI', 'Audit'],
      experience: [
        { title: 'Senior Accountant', company: 'ACME', description: '- Led the monthly close\n- Cut close time 30%\n- Saved $1.2M via automation' },
        { title: 'Accountant', company: 'X', description: '- Built the VAT reporting process\n- Improved accuracy 25%' },
      ],
      education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting', year: '2012' }],
      projects: [{ name: 'Billing revamp' }],
      certifications: [{ name: 'CPA' }],
      languages: [{ name: 'Arabic' }],
      awards: [{ title: 'Employee of year' }],
    };
    const a = analyzeProfile(strong as any);
    expect(a.score).toBeGreaterThanOrEqual(85);
    expect(a.quality).toBeGreaterThan(25);
    expect(a.completeness).toBe(60);
  });

  it('returns a transparent factor breakdown that sums to the score', () => {
    const a = analyzeProfile({ fullName: 'X' } as any);
    expect(a.factors.length).toBeGreaterThan(5);
    const total = a.factors.reduce((s, f) => s + f.earned, 0);
    expect(total).toBe(a.score); // factors explain the whole score
  });
});
