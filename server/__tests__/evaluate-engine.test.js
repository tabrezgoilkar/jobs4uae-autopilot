import { describe, it, expect } from 'vitest';
import { evaluateJob } from '../evaluate/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'], experience: [], education: [] };

describe('evaluateJob', () => {
  it('returns a normalized evaluation from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({
        jobTitle: 'Senior Accountant',
        company: 'ACME',
        location: 'Dubai',
        grade: 'B',
        recommendation: 'apply',
        summary: 'Good fit overall.',
        dimensions: [{ name: 'Skills match', score: 'B', comment: 'Strong Excel.' }],
        matchedSkills: ['Excel'],
        missingSkills: ['SAP'],
      }),
    };
    const result = await evaluateJob(PROFILE, 'Senior Accountant at ACME in Dubai', engine);
    expect(result.grade).toBe('B');
    expect(result.recommendation).toBe('apply');
    expect(result.dimensions[0].name).toBe('Skills match');
    expect(result.matchedSkills).toEqual(['Excel']);
  });

  it('normalizes a bad/partial response into safe defaults', async () => {
    const engine = { generate: async () => '{"grade":"Z","summary":"x"}' };
    const result = await evaluateJob(PROFILE, 'some job', engine);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade); // invalid 'Z' coerced
    expect(Array.isArray(result.dimensions)).toBe(true);
    expect(Array.isArray(result.matchedSkills)).toBe(true);
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'sorry, no' };
    await expect(evaluateJob(PROFILE, 'job', engine)).rejects.toThrow(/Could not understand/);
  });
});
