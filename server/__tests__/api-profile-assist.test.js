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
afterEach(() => { vi.unstubAllGlobals(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

function configure() {
  fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }));
}
function stubGemini(text) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) })));
}

describe('POST /api/profile/assist', () => {
  it('returns the assistant reply + proposed profile (not saved)', async () => {
    configure();
    stubGemini(JSON.stringify({ reply: 'Added it.', questions: [], profile: { fullName: 'Jane', projects: [{ name: 'Acme revamp', description: 'x', tech: [], url: '' }] } }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).post('/api/profile/assist').send({ message: 'I led the Acme revamp' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Added');
    expect(res.body.proposed.projects[0].name).toBe('Acme revamp');

    // must NOT have persisted (proposal awaits user confirmation)
    const after = await request(app).get('/api/profile');
    expect(after.body.projects).toEqual([]);
  });

  it('400 when no message', async () => {
    configure();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/assist').send({});
    expect(res.status).toBe(400);
  });

  it('409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/assist').send({ message: 'hi' });
    expect(res.status).toBe(409);
  });
});
