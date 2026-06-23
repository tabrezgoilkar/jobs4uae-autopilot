import { describe, it, expect } from 'vitest';
import { analyzeProfile } from './profileStrength';
import type { Profile } from '../api';

const FULL: Profile = {
  fullName: 'Tabrez Goilkar',
  email: 't@example.com',
  phone: '+971-55-000',
  location: 'Dubai, UAE',
  headline: 'Head of IT',
  summary: 'A'.repeat(220),
  skills: ['a', 'b', 'c', 'd', 'e'],
  experience: [{ company: 'X', title: 'Y', startDate: '2020', endDate: 'now', description: 'did things' }],
  education: [{ institution: 'U', degree: 'BSc', field: 'CS', year: '2010' }],
  projects: [{ name: 'P', description: 'd', tech: ['t'], url: '' }],
  certifications: [{ name: 'C', issuer: 'I', year: '2021', url: '' }],
  languages: [{ name: 'English', level: 'Fluent' }],
  awards: [{ title: 'A', issuer: 'I', year: '2022', description: '' }],
  links: [],
  updatedAt: null,
};

const without = (keys: (keyof Profile)[]): Profile => {
  const p = { ...FULL };
  for (const k of keys) (p as Record<string, unknown>)[k] = [];
  return p;
};

describe('analyzeProfile', () => {
  it('scores a fully-complete profile (all sections) at 100', () => {
    expect(analyzeProfile(FULL).score).toBe(100);
  });

  it('does NOT reach 100 when the extra sections are empty', () => {
    // Missing projects/certs/languages/awards must cost points — otherwise 100% is unearned.
    const { score } = analyzeProfile(without(['projects', 'certifications', 'languages', 'awards']));
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(60);
  });

  it('suggests adding the extra sections when they are missing', () => {
    const { suggestions } = analyzeProfile(without(['projects', 'certifications', 'languages', 'awards']));
    const titles = suggestions.map((s) => s.title.toLowerCase()).join(' | ');
    expect(titles).toContain('project');
  });

  it('gives an almost-empty profile a low score and many suggestions', () => {
    const empty = { ...FULL, fullName: 'Only Name', headline: '', email: '', phone: '', location: '', summary: '', skills: [], experience: [], education: [], projects: [], certifications: [], languages: [], awards: [] } as Profile;
    const { score, suggestions } = analyzeProfile(empty);
    expect(score).toBeLessThan(20);
    expect(suggestions.length).toBeGreaterThan(3);
  });

  it('clamps score to 0..100', () => {
    const { score } = analyzeProfile(FULL);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
