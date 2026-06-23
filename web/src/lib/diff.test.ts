import { describe, it, expect } from 'vitest';
import { diffLines } from './diff';

describe('diffLines', () => {
  it('marks every line as unchanged when both sides are identical', () => {
    const text = 'one\ntwo\nthree';
    const result = diffLines(text, text);
    expect(result.every((l) => l.type === 'same')).toBe(true);
    expect(result.map((l) => l.text)).toEqual(['one', 'two', 'three']);
  });

  it('marks an appended line as an addition and keeps the rest unchanged', () => {
    const result = diffLines('one\ntwo', 'one\ntwo\nthree');
    expect(result).toEqual([
      { type: 'same', text: 'one' },
      { type: 'same', text: 'two' },
      { type: 'add', text: 'three' },
    ]);
  });

  it('marks a removed line as a removal', () => {
    const result = diffLines('one\ntwo\nthree', 'one\nthree');
    expect(result).toEqual([
      { type: 'same', text: 'one' },
      { type: 'remove', text: 'two' },
      { type: 'same', text: 'three' },
    ]);
  });

  it('represents a changed line as a removal followed by an addition', () => {
    const result = diffLines('hello world', 'hello there');
    expect(result).toContainEqual({ type: 'remove', text: 'hello world' });
    expect(result).toContainEqual({ type: 'add', text: 'hello there' });
  });

  it('treats an empty baseline as everything being added', () => {
    const result = diffLines('', 'fresh\nlines');
    expect(result).toEqual([
      { type: 'add', text: 'fresh' },
      { type: 'add', text: 'lines' },
    ]);
  });

  it('preserves order across interleaved additions and removals', () => {
    const result = diffLines('a\nb\nc', 'a\nx\nc\nd');
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ]);
  });
});
