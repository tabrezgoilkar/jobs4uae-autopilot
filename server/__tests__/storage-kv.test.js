import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { getJson, setJson } from '../storage/kv.js';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-kv-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL; // force the filesystem impl
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kv storage adapter (filesystem)', () => {
  it('returns null for a missing key', async () => {
    expect(await getJson('user_a', 'profile')).toBeNull();
  });

  it('round-trips an object per user', async () => {
    await setJson('user_a', 'profile', { fullName: 'Jane' });
    expect(await getJson('user_a', 'profile')).toEqual({ fullName: 'Jane' });
  });

  it('isolates data between users', async () => {
    await setJson('user_a', 'profile', { fullName: 'Jane' });
    await setJson('user_b', 'profile', { fullName: 'Bob' });
    expect((await getJson('user_a', 'profile')).fullName).toBe('Jane');
    expect((await getJson('user_b', 'profile')).fullName).toBe('Bob');
  });

  it("keeps the 'local' user flat in the data dir (back-compatible)", async () => {
    await setJson('local', 'profile', { fullName: 'Owner' });
    expect(fs.existsSync(path.join(tmpDir, 'profile.json'))).toBe(true);
    expect((await getJson('local', 'profile')).fullName).toBe('Owner');
  });

  it('namespaces real users under data/u/<userId>/', async () => {
    await setJson('user_a', 'documents', [{ id: 'd1' }]);
    expect(fs.existsSync(path.join(tmpDir, 'u', 'user_a', 'documents.json'))).toBe(true);
  });

  it('defaults a missing userId to local', async () => {
    await setJson(undefined, 'profile', { fullName: 'Default' });
    expect((await getJson(undefined, 'profile')).fullName).toBe('Default');
    expect(fs.existsSync(path.join(tmpDir, 'profile.json'))).toBe(true);
  });

  it('sanitizes userId and key so they cannot escape the data dir', async () => {
    await setJson('../../evil', '../../escape', { x: 1 });
    expect(fs.existsSync(path.join(tmpDir, '..', 'escape.json'))).toBe(false);
    expect(await getJson('../../evil', '../../escape')).toEqual({ x: 1 });
  });
});
