import { describe, it, expect } from 'vitest';
import { generateDocuments } from '../documents/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'] };

describe('generateDocuments', () => {
  it('returns resume, cover letter, fit score and missing skills from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({
        resumeMarkdown: '# Jane\\nResume',
        coverLetterMarkdown: 'Dear Hiring Manager,',
        fitScore: 'B',
        missingSkills: ['SAP', 'IFRS'],
      }),
    };
    const docs = await generateDocuments(PROFILE, 'Accountant role', engine);
    expect(docs.resumeMarkdown).toContain('Jane');
    expect(docs.coverLetterMarkdown).toContain('Dear');
    expect(docs.fitScore).toBe('B');
    expect(docs.missingSkills).toEqual(['SAP', 'IFRS']);
  });

  it('coerces an invalid fit score to a safe grade and defaults missingSkills to []', async () => {
    const engine = { generate: async () => JSON.stringify({ resumeMarkdown: '# R', coverLetterMarkdown: 'C', fitScore: 'Z' }) };
    const docs = await generateDocuments(PROFILE, 'job', engine);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(docs.fitScore);
    expect(docs.missingSkills).toEqual([]);
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'no json here' };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/Could not understand/);
  });

  it('throws when the AI returns empty document content', async () => {
    const engine = { generate: async () => JSON.stringify({ resumeMarkdown: '', coverLetterMarkdown: '' }) };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/did not return/);
  });
});
