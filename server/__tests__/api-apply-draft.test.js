import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-apply-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/apply/draft', () => {
  it('runs drafter -> reviewer -> ATS and returns all three', async () => {
    // Mock the AI engine so no real model is called.
    vi.mock('../ai/index.js', () => ({
      createEngine: () => ({
        generate: async ({ system }) => {
          if (system.includes('career-coach')) {
            return JSON.stringify({ resumeMarkdown: '# CV\nNode.js', coverLetterMarkdown: 'Hi', rationale: 'matched skills' });
          }
          // reviewer
          return JSON.stringify({ honestyScore: 100, approved: true, issues: [] });
        },
      }),
    }));

    // Seed a completed config so the route does not 409.
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ setupComplete: true, engine: 'ollama' }));

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/draft').send({ jobText: 'We need Node.js' });

    expect(res.status).toBe(200);
    expect(res.body.draft.resumeMarkdown).toMatch(/Node\.js/);
    expect(res.body.review.honestyScore).toBe(100);
    expect(res.body.review.approved).toBe(true);
    expect(res.body.ats).toHaveProperty('presentKeywords');
    expect(res.body.ats.presentKeywords).toContain('node.js');
  });

  it('409s when AI setup is not complete', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/draft').send({ jobText: 'x' });
    expect(res.status).toBe(409);
  });

  it('400s on empty jobText', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ setupComplete: true, engine: 'ollama' }));
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/draft').send({ jobText: '   ' });
    expect(res.status).toBe(400);
  });
});
