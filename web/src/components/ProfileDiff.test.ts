import { describe, it, expect } from 'vitest';
import { buildDiff } from './ProfileDiff';
import type { Profile } from '../api';

const base: Profile = {
  fullName: 'Fahad', headline: 'Draftsman', email: 'a@b.com', phone: '1', location: 'Dubai',
  summary: 'Old summary.', skills: ['AUTOCAD', 'REVIT'], links: ['linkedin.com/x'],
  experience: [{ title: 'Draft', company: 'C', startDate: '2020', endDate: '2023', description: 'old' }],
  education: [], projects: [], certifications: [], languages: [], awards: [], updatedAt: null,
};

describe('buildDiff', () => {
  it('detects a changed scalar', () => {
    const next = { ...base, summary: 'New sharper summary.' };
    const rows = buildDiff(base, next);
    const row = rows.find((r) => r.label === 'summary' && r.kind === 'changed');
    expect(row).toBeTruthy();
    expect(row!.before).toBe('Old summary.');
    expect(row!.after).toBe('New sharper summary.');
  });

  it('detects added and removed skills', () => {
    const next = { ...base, skills: ['AUTOCAD', 'SKETCHUP'] };
    const rows = buildDiff(base, next);
    expect(rows.find((r) => r.label === 'skills' && r.kind === 'added' && r.after === 'SKETCHUP')).toBeTruthy();
    expect(rows.find((r) => r.label === 'skills' && r.kind === 'removed' && r.before === 'REVIT')).toBeTruthy();
  });

  it('detects an added experience entry', () => {
    const next = { ...base, experience: [...base.experience, { title: 'Senior Draft', company: 'Y', startDate: '2023', endDate: 'Present', description: 'new' }] };
    const rows = buildDiff(base, next);
    const added = rows.find((r) => r.label === 'experience' && r.kind === 'added' && r.after.includes('Senior Draft'));
    expect(added).toBeTruthy();
  });

  it('returns nothing when profiles are identical', () => {
    expect(buildDiff(base, { ...base, experience: [{ ...base.experience[0] }] })).toHaveLength(0);
  });
});
