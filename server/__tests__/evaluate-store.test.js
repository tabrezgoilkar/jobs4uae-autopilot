import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('evaluations store', () => {
  it('starts empty', async () => {
    const { listEvaluations } = await import('../evaluate/store.js');
    expect(listEvaluations()).toEqual([]);
  });

  it('adds an evaluation with an id and createdAt, newest first', async () => {
    const { addEvaluation, listEvaluations } = await import('../evaluate/store.js');
    const a = addEvaluation({ jobTitle: 'A', grade: 'B' });
    const b = addEvaluation({ jobTitle: 'B', grade: 'A' });
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    const list = listEvaluations();
    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe('B'); // newest first
  });

  it('gets an evaluation by id', async () => {
    const { addEvaluation, getEvaluation } = await import('../evaluate/store.js');
    const a = addEvaluation({ jobTitle: 'X', grade: 'C' });
    expect(getEvaluation(a.id).jobTitle).toBe('X');
    expect(getEvaluation('missing')).toBe(null);
  });
});
