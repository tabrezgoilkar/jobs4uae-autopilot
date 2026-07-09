import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-upskill-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeJson(name, data) {
  fs.writeFileSync(path.join(tmpDir, name), JSON.stringify(data, null, 2));
}

describe('GET /api/upskill/heatmap', () => {
  it('joins applications to evaluations and ranks missing skills by gap', async () => {
    // two evaluated jobs, both missing 'kubernetes', one also missing 'aws'
    const evaluations = [
      {
        id: 'ev_1', jobTitle: 'Backend Engineer',
        missingSkills: ['kubernetes', 'aws'],
        jobText: 'We need kubernetes and aws. 5+ years.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ev_2', jobTitle: 'Platform Engineer',
        missingSkills: ['kubernetes'],
        jobText: 'kubernetes required. 3+ years.',
        createdAt: new Date().toISOString(),
      },
    ];
    const applications = [
      { id: 'app_1', jobTitle: 'Backend Engineer', evaluationId: 'ev_1', status: 'applied', createdAt: new Date().toISOString() },
      { id: 'app_2', jobTitle: 'Platform Engineer', evaluationId: 'ev_2', status: 'saved', createdAt: new Date().toISOString() },
    ];
    writeJson('evaluations.json', evaluations);
    writeJson('applications.json', applications);

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/upskill/heatmap');

    expect(res.status).toBe(200);
    expect(res.body.totalJobs).toBe(2);
    const k8s = res.body.cells.find((c) => c.skill === 'kubernetes');
    expect(k8s).toBeTruthy();
    expect(k8s.demand).toBe(2);
    expect(k8s.gapScore).toBeGreaterThan(0);
  });

  it('returns empty cells when there are no applications', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/upskill/heatmap');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cells: [], totalJobs: 0 });
  });
});
