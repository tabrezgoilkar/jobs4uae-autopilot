import { describe, it, expect } from 'vitest';
import { renderProfileToMarkdown } from '../documents/baseline.js';

const FULL = {
  fullName: 'Tabrez Goilkar',
  email: 'tabrez@example.com',
  phone: '+971-55-000',
  location: 'Dubai, UAE',
  headline: 'Head of IT',
  summary: 'Visionary IT executive with 20+ years of experience.',
  skills: ['Leadership', 'Cybersecurity', 'SAP'],
  experience: [
    {
      company: 'Elite Group',
      title: 'Group Head of IT',
      startDate: 'Oct 2024',
      endDate: 'Present',
      description: 'Spearhead the end-to-end IT strategy.',
    },
  ],
  education: [
    { institution: 'Amity University', degree: 'MBA', field: 'Leadership', year: '2018' },
  ],
  projects: [{ name: 'Data Lake', description: 'Built a data platform', tech: ['Spark'], url: '' }],
  certifications: [{ name: 'ISO 27001 LA', issuer: 'PECB', year: '2021', url: '' }],
  languages: [{ name: 'English', level: 'Fluent' }],
  awards: [{ title: 'CIO of the Year', issuer: 'Gov', year: '2023', description: '' }],
  links: ['linkedin.com/in/tabrezgoilkar'],
  updatedAt: null,
};

describe('renderProfileToMarkdown', () => {
  it('renders the full name as an H1 heading and the headline below it', () => {
    const md = renderProfileToMarkdown(FULL);
    expect(md).toContain('# Tabrez Goilkar');
    expect(md).toContain('Head of IT');
  });

  it('includes a contact line with email, phone and location', () => {
    const md = renderProfileToMarkdown(FULL);
    expect(md).toContain('tabrez@example.com');
    expect(md).toContain('+971-55-000');
    expect(md).toContain('Dubai, UAE');
    expect(md).toContain('linkedin.com/in/tabrezgoilkar');
  });

  it('renders the summary, skills, experience and education sections', () => {
    const md = renderProfileToMarkdown(FULL);
    expect(md).toContain('## Summary');
    expect(md).toContain('Visionary IT executive');
    expect(md).toContain('## Skills');
    expect(md).toContain('Cybersecurity');
    expect(md).toContain('## Experience');
    expect(md).toContain('Group Head of IT');
    expect(md).toContain('Elite Group');
    expect(md).toContain('Oct 2024');
    expect(md).toContain('Present');
    expect(md).toContain('Spearhead the end-to-end IT strategy.');
    expect(md).toContain('## Education');
    expect(md).toContain('MBA');
    expect(md).toContain('Amity University');
  });

  it('renders optional sections when present', () => {
    const md = renderProfileToMarkdown(FULL);
    expect(md).toContain('## Projects');
    expect(md).toContain('Data Lake');
    expect(md).toContain('## Certifications');
    expect(md).toContain('ISO 27001 LA');
    expect(md).toContain('## Languages');
    expect(md).toContain('English');
    expect(md).toContain('## Awards');
    expect(md).toContain('CIO of the Year');
  });

  it('omits sections that have no data', () => {
    const minimal = {
      fullName: 'Jane Doe',
      email: '',
      phone: '',
      location: '',
      headline: '',
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      awards: [],
      links: [],
    };
    const md = renderProfileToMarkdown(minimal);
    expect(md).toContain('# Jane Doe');
    expect(md).not.toContain('## Summary');
    expect(md).not.toContain('## Skills');
    expect(md).not.toContain('## Experience');
    expect(md).not.toContain('## Projects');
    expect(md).not.toContain('## Awards');
  });

  it('does not throw on an empty or partial profile object', () => {
    expect(() => renderProfileToMarkdown({})).not.toThrow();
    expect(() => renderProfileToMarkdown(undefined)).not.toThrow();
    expect(typeof renderProfileToMarkdown({})).toBe('string');
  });
});
