import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Mock the real browser so no window launches; expose recorded field fills.
const fills = [];
vi.mock('../apply/browser.js', () => ({
  connect: vi.fn(async () => ({ ok: true })),
  confirm: vi.fn(async () => ({ connected: true })),
  disconnect: vi.fn(async () => ({ ok: true })),
  isOpen: () => false,
  openJobPage: vi.fn(async () => ({
    adapter: {
      fillField: async (selector, value) => { fills.push({ selector, value }); return true; },
      setText: async () => true,
      uploadFile: async () => true,
      detectQuestions: async () => [{ id: 'q1', selector: '#q1', label: 'Current basic salary?', type: 'text' }],
    },
  })),
}));

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  fills.length = 0;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }));
  // The matcher calls the engine for the unknown screening question → returns "ask".
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"action":"ask"}' }] } }] }) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('connections API', () => {
  it('GET /api/connections lists Indeed as not-yet-connected', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/connections');
    expect(res.status).toBe(200);
    const indeed = res.body.find((b) => b.id === 'indeed');
    expect(indeed).toMatchObject({ name: 'Indeed', connected: false });
  });

  it('confirm marks a board connected; disconnect clears it', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const confirmed = await request(app).post('/api/connections/indeed/confirm');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.find((b) => b.id === 'indeed').connected).toBe(true);

    const disc = await request(app).post('/api/connections/indeed/disconnect');
    expect(disc.body.find((b) => b.id === 'indeed').connected).toBe(false);
  });

  it('connect returns ok (opens the login window)', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/connections/indeed/connect');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('apply flow API', () => {
  it('rejects /apply/start until the board is connected', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/start').send({ board: 'indeed', jobUrl: 'https://indeed.com/job/1' });
    expect(res.status).toBe(409);
  });

  it('start opens the job, autofills, and returns pending questions', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/connections/indeed/confirm');

    const res = await request(app).post('/api/apply/start').send({ board: 'indeed', jobUrl: 'https://indeed.com/job/1' });
    expect(res.status).toBe(200);
    expect(res.body.pending).toHaveLength(1);
    expect(res.body.pending[0]).toMatchObject({ id: 'q1', label: 'Current basic salary?' });
  });

  it('answer fills the question in the live form, remembers it, and clears pending', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/connections/indeed/confirm');
    await request(app).post('/api/apply/start').send({ board: 'indeed', jobUrl: 'https://indeed.com/job/1' });

    const res = await request(app).post('/api/apply/answer').send({ board: 'indeed', answers: [{ id: 'q1', answer: '12000' }] });
    expect(res.status).toBe(200);
    expect(res.body.remaining).toHaveLength(0);
    expect(fills.some((f) => f.selector === '#q1' && f.value === '12000')).toBe(true);

    // remembered for next time
    const details = await request(app).get('/api/application-details');
    expect(details.body.memory.some((m) => m.answer === '12000')).toBe(true);
  });

  it('has no submit route (the user submits)', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/submit').send({ board: 'indeed' });
    expect(res.status).toBe(404);
  });
});
