import { describe, it, expect } from 'vitest';
import { clearBusy, type RowState } from './scanStore';

describe('clearBusy', () => {
  it('resets busy to false on every row but keeps result and error', () => {
    const rows: Record<string, RowState> = {
      a: { busy: true, result: { id: '1', grade: 'A', recommendation: 'apply', summary: 's', dimensions: [], matchedSkills: [], missingSkills: [] }, error: null },
      b: { busy: false, result: null, error: 'oops' },
    };
    const out = clearBusy(rows);
    expect(out.a.busy).toBe(false);
    expect(out.a.result?.grade).toBe('A');
    expect(out.b.busy).toBe(false);
    expect(out.b.error).toBe('oops');
  });

  it('returns an empty object unchanged', () => {
    expect(clearBusy({})).toEqual({});
  });
});
