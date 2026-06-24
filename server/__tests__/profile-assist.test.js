import { describe, it, expect } from 'vitest';
import { assistProfile } from '../profile/assist.js';

const PROFILE = { fullName: 'Jane Doe', headline: 'Engineer', summary: '', skills: ['Node'], experience: [], projects: [], education: [], certifications: [], languages: [], awards: [], email: '', phone: '', location: '', links: [] };
const engineReturning = (text) => ({ generate: async () => text });

describe('assistProfile', () => {
  it('returns a proposed updated profile when the AI applies a change', async () => {
    const reply = JSON.stringify({
      reply: 'Added the Acme project.',
      questions: [],
      profile: { ...PROFILE, projects: [{ name: 'Billing revamp', description: 'Cut churn', tech: [], url: '' }] },
    });
    const out = await assistProfile(PROFILE, 'I built a billing revamp project at Acme', engineReturning(reply));
    expect(out.reply).toContain('Acme');
    expect(out.proposed).not.toBeNull();
    expect(out.proposed.projects[0].name).toBe('Billing revamp');
    expect(out.questions).toEqual([]);
  });

  it('returns clarifying questions and no proposed profile when info is missing', async () => {
    const reply = JSON.stringify({ reply: 'A couple of questions first.', questions: ['Which year?', 'Your role?'], profile: null });
    const out = await assistProfile(PROFILE, 'add my project', engineReturning(reply));
    expect(out.proposed).toBeNull();
    expect(out.questions).toHaveLength(2);
  });

  it('normalizes the proposed profile (fills missing arrays/keys)', async () => {
    const reply = JSON.stringify({ reply: 'Polished your summary.', questions: [], profile: { fullName: 'Jane Doe', summary: 'Senior engineer with 8 years…' } });
    const out = await assistProfile(PROFILE, 'improve my summary', engineReturning(reply));
    expect(out.proposed.summary).toContain('Senior engineer');
    expect(Array.isArray(out.proposed.skills)).toBe(true);
    expect(Array.isArray(out.proposed.experience)).toBe(true);
  });

  it('throws a friendly error when the AI returns junk', async () => {
    await expect(assistProfile(PROFILE, 'x', engineReturning('sorry no idea'))).rejects.toThrow(/could not understand/i);
  });
});
