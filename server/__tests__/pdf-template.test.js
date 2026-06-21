import { describe, it, expect } from 'vitest';
import { resumeHtml, coverLetterHtml } from '../documents/pdf/template.js';

const profile = {
  fullName: 'Jane Al-Rashidi',
  email: 'jane@example.com',
  phone: '+971 50 000 0001',
  location: 'Dubai, UAE',
  nationality: 'British',
  visaStatus: 'Employment visa',
  noticePeriod: '1 month',
  languages: 'English, Arabic',
  drivingLicence: 'UAE',
};

describe('resumeHtml', () => {
  it('includes the candidate full name', () => {
    const html = resumeHtml(profile, '# Experience\nDid things');
    expect(html).toContain('Jane Al-Rashidi');
  });

  it('renders a Personal Details section', () => {
    const html = resumeHtml(profile, '# Experience\nDid things');
    expect(html).toContain('Personal Details');
  });

  it('renders nationality in Personal Details', () => {
    const html = resumeHtml(profile, '');
    expect(html).toContain('British');
  });

  it('renders the markdown body — heading becomes <h1>', () => {
    const html = resumeHtml(profile, '# Experience\nDid things');
    expect(html).toMatch(/<h1[^>]*>Experience<\/h1>/i);
  });

  it('omits Personal Details section when no personal detail values are present', () => {
    const minimal = { fullName: 'Ali Hassan' };
    const html = resumeHtml(minimal, '');
    // The Personal Details section heading should not appear
    expect(html).not.toContain('Personal Details');
  });

  it('never renders the string "undefined" in the output', () => {
    const html = resumeHtml({ fullName: 'Test User' }, '');
    expect(html).not.toContain('undefined');
  });

  it('includes contact line when email/phone/location are set', () => {
    const html = resumeHtml(profile, '');
    expect(html).toContain('jane@example.com');
    expect(html).toContain('Dubai, UAE');
  });
});

describe('coverLetterHtml', () => {
  it('includes the candidate full name', () => {
    const html = coverLetterHtml(profile, 'Dear Hiring Manager,\n\nI am excited...');
    expect(html).toContain('Jane Al-Rashidi');
  });

  it('renders the markdown body text', () => {
    const html = coverLetterHtml(profile, 'Dear Hiring Manager,\n\nI am excited...');
    expect(html).toContain('I am excited');
  });

  it('does not render a Personal Details section', () => {
    const html = coverLetterHtml(profile, 'Hello');
    expect(html).not.toContain('Personal Details');
  });
});
