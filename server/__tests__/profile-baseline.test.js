import { describe, it, expect, vi } from 'vitest';
import { buildBaseline } from '../profile/baseline.js';

const base = (over = {}) => ({
  fullName: 'Jane Doe', email: '', phone: '', location: 'Dubai', headline: 'Engineer', summary: '',
  skills: ['Node.js'],
  experience: [{ company: 'Acme', title: 'Senior Engineer', startDate: '2021', endDate: 'Present', description: 'Payments.' }],
  education: [], projects: [], certifications: [], languages: [], awards: [], links: [],
  ...over,
});

describe('buildBaseline', () => {
  it('generates a professional summary when blank and experience exists', async () => {
    const engine = { generate: vi.fn(async () => '  Seasoned engineer who ships payments systems.  ') };
    const { profile, summaryGenerated } = await buildBaseline(base(), engine);
    expect(summaryGenerated).toBe(true);
    expect(profile.summary).toBe('Seasoned engineer who ships payments systems.'); // trimmed
    expect(engine.generate).toHaveBeenCalledTimes(1);
  });

  it('never overwrites an existing summary', async () => {
    const engine = { generate: vi.fn() };
    const { profile, summaryGenerated } = await buildBaseline(base({ summary: 'My own words.' }), engine);
    expect(summaryGenerated).toBe(false);
    expect(profile.summary).toBe('My own words.');
    expect(engine.generate).not.toHaveBeenCalled();
  });

  it('does not fabricate a summary when there is no experience', async () => {
    const engine = { generate: vi.fn() };
    const { profile, summaryGenerated } = await buildBaseline(base({ experience: [] }), engine);
    expect(summaryGenerated).toBe(false);
    expect(profile.summary).toBe('');
    expect(engine.generate).not.toHaveBeenCalled();
  });

  it('returns baseline markdown rendered from the profile', async () => {
    const { baselineMarkdown } = await buildBaseline(base({ summary: 'x' }), { generate: vi.fn() });
    expect(baselineMarkdown).toContain('# Jane Doe');
    expect(baselineMarkdown).toContain('Acme');
  });

  it('is best-effort: a failing engine leaves the summary blank without throwing', async () => {
    const engine = { generate: vi.fn(async () => { throw new Error('offline'); }) };
    const { profile, summaryGenerated, baselineMarkdown } = await buildBaseline(base(), engine);
    expect(summaryGenerated).toBe(false);
    expect(profile.summary).toBe('');
    expect(baselineMarkdown).toContain('# Jane Doe');
  });
});
