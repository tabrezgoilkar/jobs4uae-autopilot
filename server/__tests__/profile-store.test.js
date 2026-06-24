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

describe('profile store', () => {
  it('returns an empty profile when none exists', async () => {
    const { loadProfile } = await import('../profile/store.js');
    const p = await loadProfile('local');
    expect(p.fullName).toBe('');
    expect(Array.isArray(p.skills)).toBe(true);
    expect(p.skills).toHaveLength(0);
  });

  it('saves and reloads a profile, stamping updatedAt', async () => {
    const { saveProfile, loadProfile } = await import('../profile/store.js');
    const saved = await saveProfile('local', { fullName: 'Jane Doe', skills: ['Node', 'React'] });
    expect(saved.updatedAt).toBeTruthy();
    const p = await loadProfile('local');
    expect(p.fullName).toBe('Jane Doe');
    expect(p.skills).toEqual(['Node', 'React']);
  });

  it('normalizes malformed array fields to empty arrays', async () => {
    const { saveProfile, loadProfile } = await import('../profile/store.js');
    await saveProfile('local', { fullName: 'X', skills: 'not-an-array' });
    const p = await loadProfile('local');
    expect(p.skills).toEqual([]);
  });
});
