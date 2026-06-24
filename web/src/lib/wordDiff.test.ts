import { describe, it, expect } from 'vitest';
import { diffWords, diffSections } from './wordDiff';

describe('diffWords', () => {
  it('marks unchanged words as same', () => {
    const segs = diffWords('led the team', 'led the team');
    expect(segs.every((s) => s.type === 'same')).toBe(true);
    expect(segs.map((s) => s.text).join('')).toBe('led the team');
  });

  it('shows an inserted word as add and a replaced word as remove+add', () => {
    const segs = diffWords('senior engineer', 'senior frontend engineer');
    expect(segs.some((s) => s.type === 'add' && s.text.includes('frontend'))).toBe(true);
    expect(segs.some((s) => s.type === 'same' && s.text.includes('senior'))).toBe(true);
  });

  it('represents a word change as a removal and an addition', () => {
    const segs = diffWords('cut load time 40%', 'cut load time 60%');
    expect(segs.some((s) => s.type === 'remove' && s.text.includes('40%'))).toBe(true);
    expect(segs.some((s) => s.type === 'add' && s.text.includes('60%'))).toBe(true);
  });

  it('treats whole-new text as all added', () => {
    const segs = diffWords('', 'brand new line');
    expect(segs.every((s) => s.type === 'add')).toBe(true);
  });
});

describe('diffSections', () => {
  it('pairs markdown sections by heading and only flags changed ones', () => {
    const before = '## Summary\nSenior engineer.\n\n## Skills\nReact, Redux';
    const after = '## Summary\nSenior frontend engineer.\n\n## Skills\nReact, Redux';
    const sections = diffSections(before, after);
    const summary = sections.find((s) => s.heading.includes('Summary'));
    const skills = sections.find((s) => s.heading.includes('Skills'));
    expect(summary?.changed).toBe(true);
    expect(skills?.changed).toBe(false);
  });

  it('counts changes across sections', () => {
    const before = '## A\none\n\n## B\ntwo';
    const after = '## A\none changed\n\n## B\ntwo';
    const sections = diffSections(before, after);
    const totalChanged = sections.filter((s) => s.changed).length;
    expect(totalChanged).toBe(1);
  });
});
