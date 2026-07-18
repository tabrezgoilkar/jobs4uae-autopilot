import { describe, it, expect } from 'vitest';
import { extractJdSkills, flattenJdSkills, EMPTY_JD_SKILLS } from '../ai/jdSkills.js';
import { faqPresets, resolvablePresets } from '../profile/faqPresets.js';
import { generateFaqBank } from '../profile/faq.js';

describe('jdSkills', () => {
  it('returns empty shape for blank description', async () => {
    expect(await extractJdSkills('', null)).toEqual(EMPTY_JD_SKILLS);
  });

  it('returns empty shape when engine is null', async () => {
    expect(await extractJdSkills('We need a React developer', null)).toEqual(EMPTY_JD_SKILLS);
  });

  it('classifies a JD using a stub engine', async () => {
    const engine = {
      generate: async () => JSON.stringify({
        tech_stack: ['React', 'Node.js'],
        technical_skills: ['System Design'],
        other_skills: ['Communication'],
        required_skills: ['React', 'TypeScript'],
        nice_to_have: ['GraphQL'],
      }),
    };
    const out = await extractJdSkills('Senior React engineer, TypeScript required', engine);
    expect(out.tech_stack).toContain('React');
    expect(out.required_skills).toContain('TypeScript');
    expect(out.nice_to_have).toContain('GraphQL');
    expect(flattenJdSkills(out)).toContain('System Design');
  });

  it('falls back to empty shape when engine throws', async () => {
    const engine = { generate: async () => { throw new Error('boom'); } };
    expect(await extractJdSkills('JD text', engine)).toEqual(EMPTY_JD_SKILLS);
  });
});

describe('faqPresets', () => {
  it('returns the common screening-question catalog', () => {
    const items = faqPresets({ location: 'Dubai, UAE' });
    const questions = items.map((i) => i.question);
    expect(questions.some((q) => /visa/i.test(q))).toBe(true);
    expect(questions.some((q) => /notice period/i.test(q))).toBe(true);
  });

  it('grounds visa answer for a UAE-based profile', () => {
    const resolved = resolvablePresets({ location: 'Dubai, UAE' });
    const visa = resolved.find((i) => /visa/i.test(i.question));
    expect(visa?.answer).toMatch(/UAE/i);
  });

  it('leaves notice-period unanswered when not in profile', () => {
    const items = faqPresets({ location: 'Dubai, UAE' });
    const notice = items.find((i) => /notice period/i.test(i.question));
    expect(notice?.answer).toBeNull();
  });
});

describe('generateFaqBank (with presets)', () => {
  it('includes resolvable screening presets for a UAE profile', async () => {
    const bank = await generateFaqBank({ location: 'Dubai, UAE', links: ['https://github.com/me'], experience: [{ title: 'Engineer' }] }, null);
    const questions = bank.map((b) => b.question);
    expect(questions.some((q) => /visa/i.test(q))).toBe(true);
    expect(questions.some((q) => /portfolio|LinkedIn profile/i.test(q))).toBe(true);
    expect(bank.length).toBeLessThanOrEqual(12);
    // every answer must be non-empty (no fabricated blanks)
    expect(bank.every((b) => b.answer && b.answer.trim())).toBe(true);
  });

  it('produces a non-empty bank even for an empty profile', async () => {
    const bank = await generateFaqBank({}, null);
    expect(bank.length).toBeGreaterThanOrEqual(3);
  });
});
