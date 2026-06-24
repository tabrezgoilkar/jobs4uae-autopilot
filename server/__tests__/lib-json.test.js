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
  it('repairs raw newlines/tabs inside string values (weak models)', () => {
    // A model returned real newlines inside the markdown string — invalid JSON, but recoverable.
    const raw = '{"resumeMarkdown":"# Jane\n\n## Summary\nGreat dev.","fitScore":"A"}';
    const out = extractJson(raw);
    expect(out.fitScore).toBe('A');
    expect(out.resumeMarkdown).toContain('## Summary');
    expect(out.resumeMarkdown).toContain('\n');
  });
  it('does not corrupt structural formatting when repairing', () => {
    const raw = '{\n  "a": "line1\nline2",\n  "b": 2\n}';
    const out = extractJson(raw);
    expect(out.b).toBe(2);
    expect(out.a).toBe('line1\nline2');
  });
});
