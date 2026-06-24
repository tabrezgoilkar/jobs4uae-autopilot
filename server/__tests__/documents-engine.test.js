import { describe, it, expect } from 'vitest';
import { generateDocuments } from '../documents/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'] };

// The engine parses sentinel-delimited sections (not JSON), so freeform markdown
// with quotes/newlines can't break it.
const reply = ({ fit = 'B', missing = 'SAP, IFRS', rationale = 'Led with audit.', resume = '# Jane\n- Did "great" things\nResume', cover = 'Dear Hiring Manager,' } = {}) =>
  `===FIT===\n${fit}\n===MISSING===\n${missing}\n===RATIONALE===\n${rationale}\n===RESUME===\n${resume}\n===COVER===\n${cover}\n`;

describe('generateDocuments', () => {
  it('returns resume, cover letter, fit score and missing skills from the sentinel sections', async () => {
    const engine = { generate: async () => reply() };
    const docs = await generateDocuments(PROFILE, 'Accountant role', engine);
    expect(docs.resumeMarkdown).toContain('Jane');
    expect(docs.resumeMarkdown).toContain('"great"'); // unescaped quotes survive — no JSON
    expect(docs.coverLetterMarkdown).toContain('Dear');
    expect(docs.fitScore).toBe('B');
    expect(docs.missingSkills).toEqual(['SAP', 'IFRS']);
  });

  it('coerces an invalid fit score to a safe grade and defaults missingSkills to []', async () => {
    const engine = { generate: async () => reply({ fit: 'Z', missing: '' }) };
    const docs = await generateDocuments(PROFILE, 'job', engine);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(docs.fitScore);
    expect(docs.missingSkills).toEqual([]);
  });

  it('throws a friendly error when the AI returns no recognizable sections', async () => {
    const engine = { generate: async () => 'no sections here' };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/did not return/);
  });

  it('throws when the AI returns empty document content', async () => {
    const engine = { generate: async () => '===RESUME===\n\n===COVER===\n' };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/did not return/);
  });
});
