import { describe, it, expect } from 'vitest';
import { autofillJob } from '../apply/autofill.js';
import { getBoard } from '../apply/boards/index.js';
import { normalizeKey } from '../apply/answers/store.js';

function fakeAdapter({ questions = [] } = {}) {
  const calls = { filled: [], uploaded: [], text: [], submitted: false };
  return {
    calls,
    async fillField(selector, value) { calls.filled.push({ selector, value }); return true; },
    async uploadFile(selector, filePath) { calls.uploaded.push({ selector, filePath }); return true; },
    async setText(selector, value) { calls.text.push({ selector, value }); return true; },
    async detectQuestions() { return questions; },
    async clickSubmit() { calls.submitted = true; }, // must NEVER be called
  };
}

const profile = { fullName: 'Jane Doe', email: 'jane@x.com', phone: '+971500000000', headline: 'Engineer', summary: 's', skills: [] };
const documents = { coverLetter: 'Dear hiring manager…', resumePdfPath: '/tmp/cv.pdf' };
const baseCtx = { board: getBoard('indeed'), profile, documents, details: { fields: {}, memory: [] } };

const okEngine = (text) => ({ generate: async () => text });

describe('autofillJob', () => {
  it('fills contact fields, uploads the resume PDF and pastes the cover letter', async () => {
    const adapter = fakeAdapter();
    const result = await autofillJob(adapter, baseCtx, okEngine('{"action":"ask"}'));
    const values = adapter.calls.filled.map((f) => f.value);
    expect(values).toEqual(expect.arrayContaining(['Jane Doe', 'jane@x.com', '+971500000000']));
    expect(adapter.calls.uploaded[0].filePath).toBe('/tmp/cv.pdf');
    expect(adapter.calls.text[0].value).toContain('Dear hiring manager');
    expect(result.filledCount).toBeGreaterThanOrEqual(3);
  });

  it('NEVER clicks submit', async () => {
    const adapter = fakeAdapter({ questions: [{ id: 'q1', selector: '#q1', label: 'Anything', type: 'text' }] });
    await autofillJob(adapter, baseCtx, okEngine('{"action":"ask"}'));
    expect(adapter.calls.submitted).toBe(false);
  });

  it('fills a screening question already in answer memory (no pending)', async () => {
    const adapter = fakeAdapter({ questions: [{ id: 'q1', selector: '#q1', label: 'Years of Node?', type: 'text' }] });
    const details = { fields: {}, memory: [{ id: 'm1', questionLabel: 'Years of Node', normalizedKey: normalizeKey('Years of Node'), answer: '5', source: 'user' }] };
    const result = await autofillJob(adapter, { ...baseCtx, details }, okEngine('{"action":"ask"}'));
    expect(adapter.calls.filled.some((f) => f.selector === '#q1' && f.value === '5')).toBe(true);
    expect(result.pending).toHaveLength(0);
  });

  it('returns an unknown factual question as pending with no answer', async () => {
    const adapter = fakeAdapter({ questions: [{ id: 'q2', selector: '#q2', label: 'Current basic salary?', type: 'text' }] });
    const result = await autofillJob(adapter, baseCtx, okEngine('{"action":"ask"}'));
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]).toMatchObject({ id: 'q2', label: 'Current basic salary?' });
    expect(result.pending[0].draft).toBeFalsy();
  });

  it('returns an open-ended question as pending WITH an editable draft', async () => {
    const adapter = fakeAdapter({ questions: [{ id: 'q3', selector: '#q3', label: 'Why are you a good fit?', type: 'textarea' }] });
    const result = await autofillJob(adapter, baseCtx, okEngine('{"action":"draft","answer":"I bring 8 years…"}'));
    expect(result.pending[0]).toMatchObject({ id: 'q3', draft: 'I bring 8 years…' });
  });
});
