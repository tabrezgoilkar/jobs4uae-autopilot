import { describe, it, expect } from 'vitest';
import { linkedinToProfile, looksLikeLinkedinExport } from '../profile/linkedin/map.js';

// A trimmed but representative LinkedIn Voyager `profileView` payload.
const VOYAGER = {
  profile: {
    firstName: 'Jane',
    lastName: 'Doe',
    headline: 'Senior Software Engineer',
    summary: 'Builds reliable backends.',
    locationName: 'Dubai, United Arab Emirates',
  },
  positionView: {
    elements: [
      {
        title: 'Senior Software Engineer',
        companyName: 'Acme FZ-LLC',
        description: 'Led the payments platform.',
        locationName: 'Dubai',
        timePeriod: { startDate: { month: 3, year: 2021 } }, // current role, no endDate
      },
      {
        title: 'Software Engineer',
        companyName: 'Globex',
        description: 'APIs.',
        timePeriod: { startDate: { year: 2018 }, endDate: { month: 2, year: 2021 } },
      },
    ],
  },
  educationView: {
    elements: [
      {
        schoolName: 'BITS Pilani',
        degreeName: 'B.E.',
        fieldOfStudy: 'Computer Science',
        timePeriod: { endDate: { year: 2018 } },
      },
    ],
  },
  skillView: { elements: [{ name: 'Node.js' }, { name: 'PostgreSQL' }] },
  certificationView: {
    elements: [
      { name: 'AWS Solutions Architect', authority: 'Amazon', url: 'https://aws.example', timePeriod: { startDate: { year: 2022 } } },
    ],
  },
  languageView: {
    elements: [
      { name: 'English', proficiency: 'NATIVE_OR_BILINGUAL' },
      { name: 'Arabic', proficiency: 'ELEMENTARY' },
    ],
  },
  honorView: { elements: [{ title: 'Employee of the Year', issuer: 'Acme' }] },
};

describe('linkedinToProfile — Voyager profileView', () => {
  const p = linkedinToProfile(VOYAGER);

  it('maps the basics from the profile top card', () => {
    expect(p.fullName).toBe('Jane Doe');
    expect(p.headline).toBe('Senior Software Engineer');
    expect(p.summary).toBe('Builds reliable backends.');
    expect(p.location).toBe('Dubai, United Arab Emirates');
  });

  it('maps positions to experience with YYYY-MM dates and a Present end', () => {
    expect(p.experience).toHaveLength(2);
    expect(p.experience[0]).toMatchObject({
      company: 'Acme FZ-LLC',
      title: 'Senior Software Engineer',
      startDate: '2021-03',
      endDate: 'Present',
      description: 'Led the payments platform.',
    });
    // year-only start is allowed; month-2 end formats with zero pad
    expect(p.experience[1].startDate).toBe('2018');
    expect(p.experience[1].endDate).toBe('2021-02');
  });

  it('maps education, skills, certifications, languages and awards', () => {
    expect(p.education[0]).toMatchObject({ institution: 'BITS Pilani', degree: 'B.E.', field: 'Computer Science', year: '2018' });
    expect(p.skills).toEqual(['Node.js', 'PostgreSQL']);
    expect(p.certifications[0]).toMatchObject({ name: 'AWS Solutions Architect', issuer: 'Amazon', year: '2022', url: 'https://aws.example' });
    expect(p.languages).toEqual([
      { name: 'English', level: 'Native or bilingual' },
      { name: 'Arabic', level: 'Elementary' },
    ]);
    expect(p.awards[0]).toMatchObject({ title: 'Employee of the Year', issuer: 'Acme' });
  });

  it('returns a fully normalized profile shape (no missing keys)', () => {
    expect(p).toHaveProperty('projects');
    expect(Array.isArray(p.projects)).toBe(true);
    expect(p).toHaveProperty('links');
  });
});

describe('linkedinToProfile — JSON Resume', () => {
  const JSON_RESUME = {
    basics: {
      name: 'John Roe',
      email: 'john@example.com',
      phone: '+971500000000',
      label: 'Data Engineer',
      summary: 'Pipelines.',
      location: { city: 'Abu Dhabi', countryCode: 'AE' },
      profiles: [{ network: 'GitHub', url: 'https://github.com/johnroe' }],
    },
    work: [{ name: 'DataCo', position: 'Data Engineer', startDate: '2020-01', endDate: '2023-06', summary: 'ETL.' }],
    education: [{ institution: 'NYU', studyType: 'MSc', area: 'Data Science', endDate: '2019' }],
    skills: [{ name: 'Python' }, { name: 'Spark' }],
    languages: [{ language: 'English', fluency: 'Native' }],
  };
  const p = linkedinToProfile(JSON_RESUME);

  it('maps JSON Resume basics, work and education', () => {
    expect(p.fullName).toBe('John Roe');
    expect(p.email).toBe('john@example.com');
    expect(p.phone).toBe('+971500000000');
    expect(p.headline).toBe('Data Engineer');
    expect(p.experience[0]).toMatchObject({ company: 'DataCo', title: 'Data Engineer', startDate: '2020-01', endDate: '2023-06' });
    expect(p.education[0]).toMatchObject({ institution: 'NYU', degree: 'MSc', field: 'Data Science', year: '2019' });
    expect(p.skills).toEqual(['Python', 'Spark']);
    expect(p.languages).toEqual([{ name: 'English', level: 'Native' }]);
    expect(p.links).toContain('https://github.com/johnroe');
  });
});

describe('looksLikeLinkedinExport', () => {
  it('accepts a Voyager payload', () => {
    expect(looksLikeLinkedinExport(VOYAGER)).toBe(true);
  });
  it('accepts a JSON Resume payload', () => {
    expect(looksLikeLinkedinExport({ basics: { name: 'X' }, work: [] })).toBe(true);
  });
  it('rejects unrelated JSON', () => {
    expect(looksLikeLinkedinExport({ hello: 'world' })).toBe(false);
    expect(looksLikeLinkedinExport(null)).toBe(false);
  });
});
