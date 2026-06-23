import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig() {
  fs.writeFileSync(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }),
  );
}
function stubGemini(jsonText) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }),
  })));
}

describe('documents API', () => {
  it('POST /api/documents/generate returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({ jobText: 'x' });
    expect(res.status).toBe(409);
  });

  it('POST /api/documents/generate returns 400 with no jobText and no evaluationId', async () => {
    writeConfig();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/documents/generate returns tailored markdown from pasted jobText', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ resumeMarkdown: '# Jane', coverLetterMarkdown: 'Dear team', fitScore: 'A', missingSkills: ['SAP'] }));
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({ jobText: 'Accountant', jobTitle: 'Accountant', company: 'ACME' });
    expect(res.status).toBe(200);
    expect(res.body.resumeMarkdown).toContain('Jane');
    expect(res.body.coverLetterMarkdown).toContain('Dear');
    expect(res.body.jobTitle).toBe('Accountant');
    expect(res.body.fitScore).toBe('A');
    expect(res.body.missingSkills).toEqual(['SAP']);
  });

  it('POST /api/documents/generate can pull jobText from a saved evaluation', async () => {
    writeConfig();
    // First create an evaluation (eval-shaped JSON), capturing its id.
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const ev = await request(app).post('/api/evaluate').send({ jobText: 'EVAL-JOB-TEXT' });
    // Now re-stub with doc-shaped JSON and generate from that evaluation.
    stubGemini(JSON.stringify({ resumeMarkdown: '# Tailored', coverLetterMarkdown: 'Hello' }));
    const res = await request(app).post('/api/documents/generate').send({ evaluationId: ev.body.id });
    expect(res.status).toBe(200);
    expect(res.body.resumeMarkdown).toContain('Tailored');
    expect(res.body.evaluationId).toBe(ev.body.id);
  });

  it('POST /api/documents/generate includes a baseResumeMarkdown built from the profile, not the AI output', async () => {
    writeConfig();
    fs.writeFileSync(
      path.join(tmpDir, 'profile.json'),
      JSON.stringify({ fullName: 'Base Candidate', headline: 'Engineer', summary: 'My real summary', skills: ['X'] }),
    );
    stubGemini(JSON.stringify({ resumeMarkdown: '# Tailored Jane', coverLetterMarkdown: 'Dear', fitScore: 'A', missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({ jobText: 'Engineer role' });
    expect(res.status).toBe(200);
    expect(typeof res.body.baseResumeMarkdown).toBe('string');
    expect(res.body.baseResumeMarkdown).toContain('Base Candidate'); // from the profile
    expect(res.body.baseResumeMarkdown).toContain('My real summary');
    expect(res.body.baseResumeMarkdown).not.toContain('Tailored Jane'); // NOT the AI output
    expect(res.body.resumeMarkdown).toContain('Tailored Jane'); // tailored CV still returned
  });

  it('saves, lists, gets, and updates a document', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const created = await request(app).post('/api/documents').send({ jobTitle: 'A', resumeMarkdown: 'r', coverLetterMarkdown: 'c' });
    expect(created.body.id).toBeTruthy();
    const list = await request(app).get('/api/documents');
    expect(list.body).toHaveLength(1);
    const got = await request(app).get(`/api/documents/${created.body.id}`);
    expect(got.body.resumeMarkdown).toBe('r');
    const updated = await request(app).post(`/api/documents/${created.body.id}`).send({ resumeMarkdown: 'r2' });
    expect(updated.body.resumeMarkdown).toBe('r2');
    const missing = await request(app).post('/api/documents/nope').send({ resumeMarkdown: 'x' });
    expect(missing.status).toBe(404);
  });

  it('POST /api/documents/generate falls back to body jobText when the evaluation lacks it', async () => {
    writeConfig();
    // Older-format evaluation record with no jobText field.
    fs.writeFileSync(
      path.join(tmpDir, 'evaluations.json'),
      JSON.stringify([{ id: 'ev_old', jobTitle: 'Legacy', company: 'Old', grade: 'C', createdAt: '2026-01-01T00:00:00.000Z' }]),
    );
    stubGemini(JSON.stringify({ resumeMarkdown: '# Fallback', coverLetterMarkdown: 'Hi' }));
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/documents/generate')
      .send({ evaluationId: 'ev_old', jobText: 'FALLBACK-JD' });
    expect(res.status).toBe(200);
    expect(res.body.resumeMarkdown).toContain('Fallback');
    expect(res.body.jobTitle).toBe('Legacy');
  });
});
