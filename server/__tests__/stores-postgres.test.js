import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Verify the evaluate/tracker stores route through the Postgres-backed kv
// adapter when DATABASE_URL is set (cloud). We mock kv.js with an in-memory
// store so no real DB or filesystem is touched.
const mem = new Map();
vi.mock('../storage/kv.js', () => ({
  usingPostgres: () => true,
  getJson: async (userId, key) => mem.get(`${userId}:${key}`) ?? null,
  setJson: async (userId, key, value) => {
    mem.set(`${userId}:${key}`, value);
    return value;
  },
}));

let tmpDir;
beforeEach(() => {
  mem.clear();
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-pg-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
  process.env.DATABASE_URL = 'postgres://user:pass@host/db';
});
afterEach(() => {
  delete process.env.DATABASE_URL;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('evaluate/tracker stores use Postgres when DATABASE_URL is set', () => {
  it('evaluate store persists per-user via kv (no file written)', async () => {
    const { addEvaluation, listEvaluations, getEvaluation } = await import('../evaluate/store.js');
    const a = await addEvaluation('user_42', { jobTitle: 'A' });
    expect(await getEvaluation('user_42', a.id)).toMatchObject({ jobTitle: 'A' });
    expect(await listEvaluations('user_42')).toHaveLength(1);
    // Different user sees nothing.
    expect(await listEvaluations('user_99')).toHaveLength(0);
    // Nothing written to the filesystem data dir.
    expect(fs.existsSync(path.join(tmpDir, 'evaluations.json'))).toBe(false);
  });

  it('tracker store persists per-user via kv (no file written)', async () => {
    const { addApplication, listApplications, getApplication, updateApplication, deleteApplication } =
      await import('../tracker/store.js');
    const a = await addApplication('user_7', { jobTitle: 'Eng', status: 'saved' });
    expect((await getApplication('user_7', a.id)).jobTitle).toBe('Eng');
    const upd = await updateApplication('user_7', a.id, { status: 'interview' });
    expect(upd.status).toBe('interview');
    expect((await listApplications('user_7'))).toHaveLength(1);
    expect(await deleteApplication('user_7', a.id)).toBe(true);
    expect(await listApplications('user_7')).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, 'applications.json'))).toBe(false);
  });
});
