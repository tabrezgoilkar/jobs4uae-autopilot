import { describe, it, expect } from 'vitest';
import { generateDocuments } from '../documents/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'] };

describe('generateDocuments', () => {
  it('returns resume and cover letter markdown from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({ resumeMarkdown: '# Jane\\nResume', coverLetterMarkdown: 'Dear Hiring Manager,' }),
    };
    const docs = await generateDocuments(PROFILE, 'Accountant role', engine);
    expect(docs.resumeMarkdown).toContain('Jane');
    expect(docs.coverLetterMarkdown).toContain('Dear');
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
