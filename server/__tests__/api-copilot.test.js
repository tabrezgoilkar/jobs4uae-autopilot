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
function stubGemini(text) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  })));
}

describe('copilot API', () => {
  it('POST /api/copilot returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/copilot').send({ question: 'Hi' });
    expect(res.status).toBe(409);
  });

  it('POST /api/copilot returns 400 when the question is empty', async () => {
    writeConfig();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/copilot').send({ question: '   ' });
    expect(res.status).toBe(400);
  });

  it('POST /api/copilot returns the AI answer', async () => {
    writeConfig();
    stubGemini('You can switch jobs after serving notice. This is general guidance, not legal advice.');
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/copilot')
      .send({ question: 'Can I switch jobs in the UAE?' });
    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/serving notice/);
  });

  it('answers even when there are no evaluations to add as context', async () => {
    writeConfig();
    stubGemini('Gratuity is based on your basic salary and years of service.');
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/copilot')
      .send({ question: 'How is gratuity calculated?', history: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/Gratuity/);
  });
});
