import { describe, it, expect } from 'vitest';
import { mergeProfile } from '../profile/linkedin/merge.js';
import { EMPTY_PROFILE } from '../profile/schema.js';

const incoming = {
  ...EMPTY_PROFILE,
  fullName: 'Jane Doe',
  headline: 'Senior Engineer',
  location: 'Dubai, UAE',
  summary: 'New summary from LinkedIn.',
  skills: ['Node.js', 'PostgreSQL', 'AWS'],
  experience: [
    { company: 'Acme', title: 'Senior Engineer', startDate: '2021-03', endDate: 'Present', description: 'x' },
    { company: 'Globex', title: 'Engineer', startDate: '2018', endDate: '2021-02', description: 'y' },
  ],
  languages: [{ name: 'English', level: 'Native' }],
};

describe('mergeProfile — into an empty profile', () => {
  const { merged, changes } = mergeProfile({ ...EMPTY_PROFILE }, incoming);

  it('fills every blank scalar and lists them', () => {
    expect(merged.fullName).toBe('Jane Doe');
    expect(merged.headline).toBe('Senior Engineer');
    expect(changes.filled).toEqual(expect.arrayContaining(['fullName', 'headline', 'location', 'summary']));
  });

  it('adds all incoming array items and counts them', () => {
    expect(merged.experience).toHaveLength(2);
    expect(merged.skills).toEqual(['Node.js', 'PostgreSQL', 'AWS']);
    expect(changes.added.experience).toBe(2);
    expect(changes.added.skills).toBe(3);
  });
});

describe('mergeProfile — into a profile the user already edited', () => {
  const existing = {
    ...EMPTY_PROFILE,
    fullName: 'Jane A. Doe', // user-edited — must be preserved
    headline: '', // blank — should be filled
    skills: ['Node.js'], // dedupe against incoming
    experience: [
      // same role as incoming[0] (company|title|startDate) — must NOT duplicate
      { company: 'Acme', title: 'Senior Engineer', startDate: '2021-03', endDate: 'Present', description: 'edited' },
    ],
  };
  const { merged, changes } = mergeProfile(existing, incoming);

  it('never overwrites a non-blank scalar', () => {
    expect(merged.fullName).toBe('Jane A. Doe');
    expect(changes.filled).not.toContain('fullName');
  });

  it('fills a blank scalar', () => {
    expect(merged.headline).toBe('Senior Engineer');
    expect(changes.filled).toContain('headline');
  });

  it('dedupes skills case-insensitively and only adds the new ones', () => {
    expect(merged.skills).toEqual(['Node.js', 'PostgreSQL', 'AWS']);
    expect(changes.added.skills).toBe(2);
  });

  it('does not duplicate an experience that already exists by key', () => {
    expect(merged.experience).toHaveLength(2); // Acme (kept, edited desc) + new Globex
    expect(merged.experience[0].description).toBe('edited'); // existing wins
    expect(changes.added.experience).toBe(1);
    expect(changes.addedItems.experience).toEqual(['Engineer — Globex']);
  });

  it('does not mutate the inputs', () => {
    expect(existing.skills).toEqual(['Node.js']);
    expect(incoming.skills).toEqual(['Node.js', 'PostgreSQL', 'AWS']);
  });
});
