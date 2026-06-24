import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, saveProfile } from '../profile/store.js';
import { listDocuments, addDocument, getDocument, updateDocument } from '../documents/store.js';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-store-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('profile store (per-user)', () => {
  it('returns an empty profile for a new user', () => {
    expect(loadProfile('user_a').fullName).toBe('');
  });

  it('saves and loads per user, isolated', () => {
    saveProfile('user_a', { fullName: 'Jane' });
    saveProfile('user_b', { fullName: 'Bob' });
    expect(loadProfile('user_a').fullName).toBe('Jane');
    expect(loadProfile('user_b').fullName).toBe('Bob');
    expect(loadProfile('user_a').updatedAt).toBeTruthy();
  });
});

describe('documents store (per-user)', () => {
  it('lists empty for a new user', () => {
    expect(listDocuments('user_a')).toEqual([]);
  });

  it('add/get/update are isolated per user', () => {
    const a = addDocument('user_a', { resumeMarkdown: 'A', coverLetterMarkdown: 'a' });
    addDocument('user_b', { resumeMarkdown: 'B', coverLetterMarkdown: 'b' });

    expect(listDocuments('user_a')).toHaveLength(1);
    expect(listDocuments('user_b')).toHaveLength(1);
    expect(getDocument('user_a', a.id).resumeMarkdown).toBe('A');
    // user_b cannot fetch user_a's document
    expect(getDocument('user_b', a.id)).toBeNull();

    const upd = updateDocument('user_a', a.id, { resumeMarkdown: 'A2' });
    expect(upd.resumeMarkdown).toBe('A2');
    expect(updateDocument('user_b', a.id, { resumeMarkdown: 'x' })).toBeNull();
  });
});
