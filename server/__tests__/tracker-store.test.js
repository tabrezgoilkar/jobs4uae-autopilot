import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-tracker-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('tracker store', () => {
  it('starts empty', async () => {
    const { listApplications } = await import('../tracker/store.js');
    expect(listApplications()).toEqual([]);
  });

  it('adds an application with server-generated id and timestamps', async () => {
    const { addApplication, listApplications } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'Engineer', company: 'ACME', location: 'Dubai' });
    expect(a.id).toMatch(/^app_/);
    expect(a.createdAt).toBeTruthy();
    expect(a.updatedAt).toBeTruthy();
    expect(a.jobTitle).toBe('Engineer');
    expect(a.company).toBe('ACME');
    expect(a.location).toBe('Dubai');
  });

  it('defaults status to "saved" when not provided', async () => {
    const { addApplication } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'Analyst' });
    expect(a.status).toBe('saved');
  });

  it('accepts a valid status and stores it', async () => {
    const { addApplication } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'Dev', status: 'applied' });
    expect(a.status).toBe('applied');
  });

  it('strips client-supplied id and timestamps', async () => {
    const { addApplication } = await import('../tracker/store.js');
    const a = addApplication({ id: 'hacked', createdAt: 'hacked', updatedAt: 'hacked', jobTitle: 'X' });
    expect(a.id).not.toBe('hacked');
    expect(a.createdAt).not.toBe('hacked');
    expect(a.updatedAt).not.toBe('hacked');
  });

  it('stores newest first', async () => {
    const { addApplication, listApplications } = await import('../tracker/store.js');
    addApplication({ jobTitle: 'First' });
    addApplication({ jobTitle: 'Second' });
    const list = listApplications();
    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe('Second');
    expect(list[1].jobTitle).toBe('First');
  });

  it('getApplication returns the record or null for missing id', async () => {
    const { addApplication, getApplication } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'Tester' });
    expect(getApplication(a.id)).toMatchObject({ jobTitle: 'Tester' });
    expect(getApplication('no-such-id')).toBeNull();
  });

  it('updateApplication changes status and updates updatedAt without touching id/createdAt', async () => {
    const { addApplication, updateApplication } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'PM', status: 'saved' });
    const updated = updateApplication(a.id, { status: 'interview', id: 'evil', createdAt: 'evil' });
    expect(updated.status).toBe('interview');
    expect(updated.id).toBe(a.id);
    expect(updated.createdAt).toBe(a.createdAt);
    expect(updated.updatedAt).not.toBe(a.updatedAt);
  });

  it('updateApplication returns null for missing id', async () => {
    const { updateApplication } = await import('../tracker/store.js');
    expect(updateApplication('no-such-id', { status: 'applied' })).toBeNull();
  });

  it('persists across module reload', async () => {
    const { addApplication } = await import('../tracker/store.js');
    addApplication({ jobTitle: 'Persisted' });

    vi.resetModules();
    const { listApplications } = await import('../tracker/store.js');
    const list = listApplications();
    expect(list).toHaveLength(1);
    expect(list[0].jobTitle).toBe('Persisted');
  });

  it('deleteApplication removes the record and returns true; returns false for missing', async () => {
    const { addApplication, deleteApplication, listApplications } = await import('../tracker/store.js');
    const a = addApplication({ jobTitle: 'ToDelete' });
    expect(deleteApplication(a.id)).toBe(true);
    expect(listApplications()).toHaveLength(0);
    expect(deleteApplication('no-such-id')).toBe(false);
  });
});
