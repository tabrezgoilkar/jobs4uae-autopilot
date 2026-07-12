import { describe, it, expect } from 'vitest';
import { renderProfileCvPdf } from '../profile/cvPdf.js';
import { renderProfileCvDocx } from '../profile/cvDocx.js';
import { profileToCvSections } from '../profile/cvSections.js';

const sampleProfile = {
  fullName: 'Aisha Rahman',
  headline: 'Senior Accountant',
  email: 'a@x.com',
  phone: '+971 50 000 0000',
  location: 'Dubai, UAE',
  summary: 'Finance professional with 8 years across the GCC.',
  skills: ['Excel', 'SAP', 'VAT', 'IFRS'],
  experience: [
    { title: 'Senior Accountant', company: 'ACME', startDate: '2019', endDate: 'Present', description: '- Owned monthly close\n- Cut close time 30%' },
  ],
  education: [{ institution: 'Uni', degree: 'BSc', field: 'Accounting', year: '2012' }],
  projects: [{ name: 'Billing revamp', description: 'Reduced churn', tech: ['SQL'] }],
  certifications: [{ name: 'CPA', issuer: 'AICPA', year: '2015' }],
  languages: [{ name: 'Arabic', level: 'Fluent' }],
  awards: [{ title: 'Employee of year', issuer: 'ACME', year: '2021', description: 'Top performer' }],
};

describe('profileToCvSections', () => {
  it('orders sections and splits bullets', () => {
    const cv = profileToCvSections(sampleProfile);
    expect(cv.name).toBe('Aisha Rahman');
    expect(cv.contact).toContain('a@x.com');
    expect(cv.sections.map((s) => s.title)).toEqual([
      'Summary', 'Skills', 'Experience', 'Education', 'Projects', 'Certifications', 'Languages', 'Awards',
    ]);
    const exp = cv.sections.find((s) => s.title === 'Experience');
    expect(exp.items[0].heading).toContain('ACME');
    expect(exp.items[0].bullets).toEqual(['Owned monthly close', 'Cut close time 30%']);
  });

  it('falls back to a name when blank', () => {
    expect(profileToCvSections({}).name).toBe('Your name');
  });
});

describe('renderProfileCvPdf', () => {
  it('produces a valid PDF', () => {
    const buf = renderProfileCvPdf(sampleProfile);
    expect(buf.slice(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(buf.toString('latin1')).toContain('%%EOF');
    expect(buf.toString('latin1')).toContain('/Catalog');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('handles an empty profile without throwing', () => {
    const buf = renderProfileCvPdf({});
    expect(buf.slice(0, 8).toString('latin1')).toBe('%PDF-1.4');
  });
});

describe('renderProfileCvDocx', () => {
  it('produces a valid OOXML zip', () => {
    const buf = renderProfileCvDocx(sampleProfile);
    // EOCD signature
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocd).toBeGreaterThan(0);
    // first local file header names the content-types part
    const lh = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const nlen = buf.readUInt16LE(lh + 26);
    const name = buf.slice(lh + 30, lh + 30 + nlen).toString('utf8');
    expect(name).toBe('[Content_Types].xml');
    expect(buf.toString('latin1')).toContain('word/document.xml');
  });
});
