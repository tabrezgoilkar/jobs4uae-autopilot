import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
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

  it('renders bullets as drawn dots, not a mis-encoded quote glyph', () => {
    const buf = renderProfileCvPdf(sampleProfile);
    const ps = buf.toString('latin1');
    // Regression: bullets used to be `•  text` which mis-encoded to a leading
    // double-quote under WinAnsiEncoding. Now bullets are filled-circle ops.
    expect(ps).not.toMatch(/\("\s/); // no leading-quote bullet marker
    expect(ps).toMatch(/c .* f Q/); // filled-circle (bullet dot) drawing ops exist
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

  it('includes a real bullet numbering definition (no auto-number fallback)', () => {
    // Regression: without word/numbering.xml Word numbered every bullet 1,2,3…
    const buf = renderProfileCvDocx(sampleProfile);
    // document.xml MUST reference numbering.xml via a relationship, otherwise
    // Word cannot resolve numId=1 and falls back to auto-numbering.
    expect(buf.toString('latin1')).toContain('word/_rels/document.xml.rels');
    // The parts are deflated in the zip; extract + inflate to read them.
    const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const readPart = (partName) => {
      const nameIdx = buf.indexOf(partName);
      const headerStart = buf.lastIndexOf(sig, nameIdx);
      expect(headerStart).toBeGreaterThan(0);
      const compSize = buf.readUInt32LE(headerStart + 18);
      const nameLen = buf.readUInt16LE(headerStart + 26);
      const dataStart = headerStart + 30 + nameLen;
      return zlib.inflateRawSync(buf.subarray(dataStart, dataStart + compSize)).toString('latin1');
    };
    const rels = readPart('word/_rels/document.xml.rels');
    expect(rels).toContain('relationships/numbering');
    const numXml = readPart('word/numbering.xml');
    expect(numXml).toMatch(/<w:num w:numId="1">/);
    expect(numXml).toMatch(/<w:numFmt w:val="bullet"\/>/);
  });
});
