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
  delete process.env.DATABASE_URL;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('profile store (per-user)', () => {
  it('returns an empty profile for a new user', async () => {
    expect((await loadProfile('user_a')).fullName).toBe('');
  });

  it('saves and loads per user, isolated', async () => {
    await saveProfile('user_a', { fullName: 'Jane' });
    await saveProfile('user_b', { fullName: 'Bob' });
    expect((await loadProfile('user_a')).fullName).toBe('Jane');
    expect((await loadProfile('user_b')).fullName).toBe('Bob');
    expect((await loadProfile('user_a')).updatedAt).toBeTruthy();
  });
});

describe('documents store (per-user)', () => {
  it('lists empty for a new user', async () => {
    expect(await listDocuments('user_a')).toEqual([]);
  });

  it('add/get/update are isolated per user', async () => {
    const a = await addDocument('user_a', { resumeMarkdown: 'A', coverLetterMarkdown: 'a' });
    await addDocument('user_b', { resumeMarkdown: 'B', coverLetterMarkdown: 'b' });

    expect(await listDocuments('user_a')).toHaveLength(1);
    expect(await listDocuments('user_b')).toHaveLength(1);
    expect((await getDocument('user_a', a.id)).resumeMarkdown).toBe('A');
    expect(await getDocument('user_b', a.id)).toBeNull();

    const upd = await updateDocument('user_a', a.id, { resumeMarkdown: 'A2' });
    expect(upd.resumeMarkdown).toBe('A2');
    expect(await updateDocument('user_b', a.id, { resumeMarkdown: 'x' })).toBeNull();
  });
});
