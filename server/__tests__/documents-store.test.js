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

describe('documents store', () => {
  it('starts empty', async () => {
    const { listDocuments } = await import('../documents/store.js');
    expect(listDocuments()).toEqual([]);
  });

  it('adds a document with id + timestamps, newest first', async () => {
    const { addDocument, listDocuments } = await import('../documents/store.js');
    const a = addDocument({ jobTitle: 'A', resumeMarkdown: '# A' });
    const b = addDocument({ jobTitle: 'B', resumeMarkdown: '# B' });
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    expect(a.updatedAt).toBeTruthy();
    const list = listDocuments();
    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe('B');
  });

  it('gets by id and updates content (touching updatedAt, preserving id/createdAt)', async () => {
    const { addDocument, getDocument, updateDocument } = await import('../documents/store.js');
    const a = addDocument({ jobTitle: 'X', resumeMarkdown: 'old' });
    expect(getDocument(a.id).resumeMarkdown).toBe('old');
    const updated = updateDocument(a.id, { resumeMarkdown: 'new', id: 'hacked', createdAt: 'hacked' });
    expect(updated.resumeMarkdown).toBe('new');
    expect(updated.id).toBe(a.id);            // id not overwritten
    expect(updated.createdAt).toBe(a.createdAt); // createdAt preserved
    expect(updateDocument('missing', {})).toBe(null);
  });
});
