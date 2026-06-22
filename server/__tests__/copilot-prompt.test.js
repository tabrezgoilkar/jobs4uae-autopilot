import { describe, it, expect } from 'vitest';
import { COPILOT_SYSTEM, buildCopilotPrompt } from '../copilot/prompt.js';
import { askCopilot } from '../copilot/engine.js';

describe('copilot prompt', () => {
  it('system prompt sets GCC scope and the not-legal-advice guardrail', () => {
    expect(COPILOT_SYSTEM).toMatch(/GCC/);
    expect(COPILOT_SYSTEM).toMatch(/not legal advice/i);
  });

  it('includes the question', () => {
    const p = buildCopilotPrompt({ question: 'How is gratuity calculated?' });
    expect(p).toContain('How is gratuity calculated?');
  });

  it('grounds in profile context when present', () => {
    const p = buildCopilotPrompt({
      profile: { headline: 'Senior Accountant', location: 'Dubai', skills: ['IFRS', 'SAP'] },
      question: 'Am I a fit for finance roles?',
    });
    expect(p).toContain('Senior Accountant');
    expect(p).toContain('Dubai');
    expect(p).toContain('IFRS');
  });

  it('summarises recent evaluations', () => {
    const p = buildCopilotPrompt({
      evaluations: [{ jobTitle: 'Accountant', company: 'Noon', location: 'Dubai', grade: 'B' }],
      question: 'Why a B?',
    });
    expect(p).toContain('Accountant');
    expect(p).toContain('graded B');
  });

  it('includes prior conversation turns', () => {
    const p = buildCopilotPrompt({
      history: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }],
      question: 'Next?',
    });
    expect(p).toMatch(/User: Hi/);
    expect(p).toMatch(/Copilot: Hello!/);
  });
});

describe('askCopilot', () => {
  it('returns the engine answer trimmed', async () => {
    const engine = { generate: async () => '  Here is your answer.  ' };
    const r = await askCopilot({ question: 'test' }, engine);
    expect(r.answer).toBe('Here is your answer.');
  });

  it('passes system + prompt to the engine', async () => {
    let captured;
    const engine = { generate: async (args) => { captured = args; return 'ok'; } };
    await askCopilot({ question: 'gratuity?' }, engine);
    expect(captured.system).toBe(COPILOT_SYSTEM);
    expect(captured.prompt).toContain('gratuity?');
  });
});
