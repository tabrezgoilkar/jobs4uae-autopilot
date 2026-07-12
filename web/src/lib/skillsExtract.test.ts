import { describe, it, expect } from 'vitest';
import { extractSkills } from './skillsExtract';
import type { Profile } from '../api';

const base: Profile = {
  fullName: 'Fahad', headline: 'Architectural Draftsman', email: 'a@b.com', phone: '1', location: 'Dubai',
  summary: 'Draftsman using Revit and AutoCAD on residential projects.', skills: ['AUTOCAD'],
  experience: [{ title: 'Draftsman', company: 'C', startDate: '2020', endDate: '2023', description: '- Created BIM models in Revit\n- Prepared shop drawings using Navisworks' }],
  education: [], projects: [], certifications: [], languages: [], awards: [], updatedAt: null,
};

describe('extractSkills', () => {
  it('finds skills mentioned in text but not already listed', () => {
    const s = extractSkills(base);
    expect(s).toContain('Revit');
    expect(s).toContain('BIM');
    expect(s).toContain('Navisworks');
  });

  it('does not suggest skills already present', () => {
    const s = extractSkills(base);
    expect(s).not.toContain('AUTOCAD');
    expect(s.some((x) => x.toLowerCase() === 'autocad')).toBe(false);
  });

  it('detects soft / cross-functional skills from prose', () => {
    const p: Profile = { ...base, summary: 'Led stakeholder management and project management for GCC rollout.' };
    const s = extractSkills(p);
    expect(s).toContain('Project Management');
    expect(s).toContain('Stakeholder Management');
  });

  it('returns empty when nothing new is detectable', () => {
    const p: Profile = { ...base, skills: ['Revit', 'BIM', 'Navisworks', 'AUTOCAD'], summary: 'Draftsman.', experience: [] };
    expect(extractSkills(p)).toEqual([]);
  });
});
