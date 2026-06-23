import { describe, it, expect } from 'vitest';
import { htmlToJobText } from '../scanner/extract.js';

describe('htmlToJobText', () => {
  it('strips tags and returns readable text', () => {
    const html = '<html><body><h1>Senior Accountant</h1><p>Manage the GL and reporting.</p></body></html>';
    const text = htmlToJobText(html);
    expect(text).toContain('Senior Accountant');
    expect(text).toContain('Manage the GL and reporting.');
    expect(text).not.toContain('<');
  });

  it('drops script and style contents entirely', () => {
    const html = '<body><style>.x{color:red}</style><script>var a=1;evil()</script><p>Real job text</p></body>';
    const text = htmlToJobText(html);
    expect(text).toContain('Real job text');
    expect(text).not.toContain('evil');
    expect(text).not.toContain('color:red');
  });

  it('collapses whitespace runs into single spaces/newlines', () => {
    const text = htmlToJobText('<p>one</p>\n\n\n   <p>two</p>');
    expect(text).not.toMatch(/ {2,}/);
    expect(text).toContain('one');
    expect(text).toContain('two');
  });

  it('caps very long input', () => {
    const big = '<p>' + 'x'.repeat(50000) + '</p>';
    expect(htmlToJobText(big).length).toBeLessThanOrEqual(12000);
  });

  it('returns empty string for empty/garbage input', () => {
    expect(htmlToJobText('')).toBe('');
    expect(htmlToJobText(undefined)).toBe('');
    expect(htmlToJobText('<script>only()</script>')).toBe('');
  });
});
