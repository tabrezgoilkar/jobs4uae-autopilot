import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Mock the browser module BEFORE any imports that depend on it.
vi.mock('../lib/browser.js', () => ({
  renderPdfFromHtml: vi.fn(async () => Buffer.from('%PDF-FAKE')),
}));

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-pdf-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function seedData() {
  const { saveProfile } = await import('../profile/store.js');
  const { addDocument } = await import('../documents/store.js');

  saveProfile({
    fullName: 'Jane Al-Rashidi',
    email: 'jane@example.com',
    phone: '+971 50 000 0001',
    location: 'Dubai, UAE',
    nationality: 'British',
  });

  const doc = addDocument({
    jobTitle: 'Finance Manager',
    company: 'ACME Corp',
    resumeMarkdown: '# Experience\nDid great things.',
    coverLetterMarkdown: 'Dear Hiring Manager,\n\nPlease hire me.',
  });

  return doc;
}

describe('PDF API', () => {
  it('POST /api/documents/:id/pdf?kind=resume returns 200 with application/pdf', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf?kind=resume`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('POST /api/documents/:id/pdf?kind=cover returns 200 with application/pdf', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf?kind=cover`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('defaults to resume when kind is omitted', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/resume/);
  });

  it('returns 404 for an unknown document id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/documents/no-such-doc/pdf?kind=resume');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 for an invalid kind', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf?kind=invalid`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('sets Content-Disposition with a pdf filename for resume', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf?kind=resume`);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.pdf/);
  });

  it('sets Content-Disposition with a pdf filename for cover letter', async () => {
    const doc = await seedData();
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post(`/api/documents/${doc.id}/pdf?kind=cover`);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.pdf/);
  });
});
