import { describe, it, expect } from 'vitest';
import { matchQuestion } from '../apply/match.js';
import { normalizeKey } from '../apply/answers/store.js';

const profile = { fullName: 'Jane Doe', headline: 'Senior Engineer', summary: 'Builds payments systems.', skills: ['Node.js'] };
const context = {
  fields: { nationality: 'Indian', expectedSalary: '18000', visaStatus: '', noticePeriod: '1 month' },
  memory: [],
  profile,
  job: 'Senior Backend Engineer at Acme',
};

function engineReturning(text) {
  return { generate: async () => text };
}
const throwingEngine = { generate: async () => { throw new Error('AI must not be called'); } };

describe('matchQuestion', () => {
  it('returns ask for a blank question without calling the AI', async () => {
    const r = await matchQuestion({ label: '' }, context, throwingEngine);
    expect(r.action).toBe('ask');
  });

  it('fills from exact answer memory WITHOUT calling the AI', async () => {
    const memory = [{ id: '1', questionLabel: 'Years of Node', normalizedKey: normalizeKey('Years of Node'), answer: '5', source: 'user' }];
    const r = await matchQuestion({ label: 'Years of Node?' }, { ...context, memory }, throwingEngine);
    expect(r).toMatchObject({ action: 'fill', answer: '5', source: 'memory' });
  });

  it('fills from a stored field when the AI maps the question to it', async () => {
    const r = await matchQuestion(
      { label: 'What is your expected monthly salary in AED?' },
      context,
      engineReturning('{"action":"fill","answer":"18000"}'),
    );
    expect(r).toMatchObject({ action: 'fill', answer: '18000' });
  });

  it('returns an editable draft for an open-ended question', async () => {
    const r = await matchQuestion(
      { label: 'Why are you a good fit for this role?' },
      context,
      engineReturning('{"action":"draft","answer":"With 8 years building payments systems, I..."}'),
    );
    expect(r.action).toBe('draft');
    expect(r.source).toBe('ai-draft');
    expect(r.answer).toContain('payments');
  });

  it('asks the user (never invents) when a factual answer is unknown', async () => {
    const r = await matchQuestion(
      { label: 'What is your current basic salary?' },
      context,
      engineReturning('{"action":"ask"}'),
    );
    expect(r).toMatchObject({ action: 'ask', source: 'unknown' });
  });

  it('falls back to ask when the AI returns junk (safe default)', async () => {
    const r = await matchQuestion({ label: 'Some weird question' }, context, engineReturning('sorry no idea'));
    expect(r.action).toBe('ask');
  });
});
