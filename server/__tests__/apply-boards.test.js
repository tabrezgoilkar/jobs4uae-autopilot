import { describe, it, expect } from 'vitest';
import { getBoard, listBoards } from '../apply/boards/index.js';

describe('board registry', () => {
  it('lists Indeed as a connectable board', () => {
    const boards = listBoards();
    const indeed = boards.find((b) => b.id === 'indeed');
    expect(indeed).toBeTruthy();
    expect(indeed.name).toBe('Indeed');
  });

  it('getBoard returns a config with a loginUrl and field map', () => {
    const b = getBoard('indeed');
    expect(b.loginUrl).toMatch(/^https:\/\//);
    expect(Array.isArray(b.fieldMap)).toBe(true);
    expect(b.resumeUpload).toBeTruthy();
  });

  it('getBoard returns undefined for an unknown board', () => {
    expect(getBoard('nope')).toBeUndefined();
  });

  it('listBoards exposes only safe public metadata (no selectors)', () => {
    const b = listBoards().find((x) => x.id === 'indeed');
    expect(b.fieldMap).toBeUndefined();
    expect(b).toHaveProperty('name');
  });
});
