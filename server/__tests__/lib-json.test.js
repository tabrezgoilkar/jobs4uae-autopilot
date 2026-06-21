import { describe, it, expect } from 'vitest';
import { extractJson } from '../lib/json.js';

describe('extractJson (shared)', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}').a).toBe(1);
  });
  it('parses JSON inside a code fence', () => {
    expect(extractJson('```json\n{"a":2}\n```').a).toBe(2);
  });
  it('parses JSON with surrounding prose', () => {
    expect(extractJson('result:\n{"a":3}\ndone').a).toBe(3);
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('nope')).toThrow();
  });
});
