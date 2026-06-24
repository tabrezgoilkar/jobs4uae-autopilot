import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { getJson, setJson } from '../storage/kv.js';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-kv-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kv storage adapter (filesystem)', () => {
  it('returns null for a missing key', () => {
    expect(getJson('user_a', 'profile')).toBeNull();
  });

  it('round-trips an object per user', () => {
    setJson('user_a', 'profile', { fullName: 'Jane' });
    expect(getJson('user_a', 'profile')).toEqual({ fullName: 'Jane' });
  });

  it('isolates data between users', () => {
    setJson('user_a', 'profile', { fullName: 'Jane' });
    setJson('user_b', 'profile', { fullName: 'Bob' });
    expect(getJson('user_a', 'profile').fullName).toBe('Jane');
    expect(getJson('user_b', 'profile').fullName).toBe('Bob');
  });

  it("keeps the 'local' user flat in the data dir (back-compatible)", () => {
    setJson('local', 'profile', { fullName: 'Owner' });
    expect(fs.existsSync(path.join(tmpDir, 'profile.json'))).toBe(true);
    expect(getJson('local', 'profile').fullName).toBe('Owner');
  });

  it('namespaces real users under data/u/<userId>/', () => {
    setJson('user_a', 'documents', [{ id: 'd1' }]);
    expect(fs.existsSync(path.join(tmpDir, 'u', 'user_a', 'documents.json'))).toBe(true);
  });

  it('defaults a missing userId to local', () => {
    setJson(undefined, 'profile', { fullName: 'Default' });
    expect(getJson(undefined, 'profile').fullName).toBe('Default');
    expect(fs.existsSync(path.join(tmpDir, 'profile.json'))).toBe(true);
  });

  it('sanitizes userId and key so they cannot escape the data dir', () => {
    setJson('../../evil', '../../escape', { x: 1 });
    // nothing is written outside the temp data dir
    expect(fs.existsSync(path.join(tmpDir, '..', 'escape.json'))).toBe(false);
    expect(getJson('../../evil', '../../escape')).toEqual({ x: 1 });
  });
});
