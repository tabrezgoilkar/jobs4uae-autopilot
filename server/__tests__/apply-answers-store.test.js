import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadDetails,
  saveDetails,
  rememberAnswer,
  findAnswer,
  normalizeKey,
  EMPTY_DETAILS,
} from '../apply/answers/store.js';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-ad-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('normalizeKey', () => {
  it('lowercases, trims and collapses whitespace/punctuation', () => {
    expect(normalizeKey('  Expected Salary (AED)? ')).toBe('expected salary aed');
    expect(normalizeKey('Notice   period')).toBe('notice period');
  });
});

describe('loadDetails / saveDetails', () => {
  it('returns empty details when nothing is saved', () => {
    const d = loadDetails();
    expect(d).toEqual(EMPTY_DETAILS);
    expect(d.fields.languages).toEqual([]);
    expect(d.memory).toEqual([]);
  });

  it('saves a partial fields patch without dropping other fields or memory', () => {
    rememberAnswer({ questionLabel: 'Years of React', answer: '5' });
    saveDetails({ fields: { nationality: 'Indian', expectedSalary: '18000' } });
    const d = loadDetails();
    expect(d.fields.nationality).toBe('Indian');
    expect(d.fields.expectedSalary).toBe('18000');
    expect(d.fields.visaStatus).toBe(''); // untouched default preserved
    expect(d.memory).toHaveLength(1); // memory preserved across a fields save
  });
});

describe('rememberAnswer / findAnswer', () => {
  it('appends a new answer with an id, normalizedKey and timestamp', () => {
    const entry = rememberAnswer({ questionLabel: 'Expected salary (AED)', answer: '18000', source: 'user' });
    expect(entry.id).toBeTruthy();
    expect(entry.normalizedKey).toBe('expected salary aed');
    expect(entry.source).toBe('user');
    expect(entry.updatedAt).toBeTruthy();
    expect(loadDetails().memory).toHaveLength(1);
  });

  it('upserts by normalizedKey — same question updates in place, keeps id', () => {
    const first = rememberAnswer({ questionLabel: 'Expected salary', answer: '15000' });
    const second = rememberAnswer({ questionLabel: 'expected   SALARY', answer: '18000' });
    expect(second.id).toBe(first.id); // same logical question
    expect(loadDetails().memory).toHaveLength(1);
    expect(loadDetails().memory[0].answer).toBe('18000'); // updated
  });

  it('findAnswer returns a stored answer by exact normalized key, else undefined', () => {
    rememberAnswer({ questionLabel: 'Do you have a UAE driving licence?', answer: 'Yes' });
    expect(findAnswer('do you have a uae driving licence')?.answer).toBe('Yes');
    expect(findAnswer('  Do you have a UAE Driving Licence? ')?.answer).toBe('Yes');
    expect(findAnswer('unrelated question')).toBeUndefined();
  });

  it('ignores blank labels/answers', () => {
    expect(rememberAnswer({ questionLabel: '', answer: 'x' })).toBeNull();
    expect(rememberAnswer({ questionLabel: 'Q', answer: '' })).toBeNull();
    expect(loadDetails().memory).toHaveLength(0);
  });
});
