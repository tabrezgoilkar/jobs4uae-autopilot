import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
function configure(setupComplete = true) {
  fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete }));
}
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"subject":"Application: Accountant — Jane","body":"Dear Hiring Manager, please find my CV attached."}' }] } }] }),
  })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/apply/email/compose', () => {
  it('drafts an email and builds draft links from a pasted post', async () => {
    configure();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/apply/email/compose')
      .send({ jobText: 'Hiring an Accountant in Dubai. Send your CV to hr@acme.com' });
    expect(res.status).toBe(200);
    expect(res.body.to).toBe('hr@acme.com');
    expect(res.body.subject).toContain('Accountant');
    expect(res.body.body).toContain('CV attached');
    expect(res.body.mailto.startsWith('mailto:hr@acme.com')).toBe(true);
    expect(res.body.gmail).toContain('mail.google.com');
  });

  it('uses an explicit recruiterEmail over one found in the text', async () => {
    configure();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/apply/email/compose')
      .send({ jobText: 'Send CV to old@acme.com', recruiterEmail: 'new@acme.com' });
    expect(res.body.to).toBe('new@acme.com');
  });

  it('returns 422 when no recruiter email is available', async () => {
    configure();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/email/compose').send({ jobText: 'DM me on LinkedIn' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when AI is not configured', async () => {
    configure(false);
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/apply/email/compose').send({ jobText: 'CV to hr@acme.com' });
    expect(res.status).toBe(409);
  });
});
