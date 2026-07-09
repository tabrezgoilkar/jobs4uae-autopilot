import { describe, it, expect } from 'vitest';
import { extractJson, parseCvText } from '../profile/parse.js';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"fullName":"Jane"}').fullName).toBe('Jane');
  });
  it('parses JSON inside a code fence', () => {
    expect(extractJson('```json\n{"fullName":"Bob"}\n```').fullName).toBe('Bob');
  });
  it('parses JSON with surrounding prose', () => {
    expect(extractJson('Here you go:\n{"fullName":"Sue"}\nThanks').fullName).toBe('Sue');
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });

  const BS = String.fromCharCode(92); // one literal backslash
  it('repairs backslash-escaped markdown punctuation', () => {
    // Model emits \* / \- when told to preserve Markdown — invalid JSON escapes.
    const r = extractJson(`{"summary":"Led the ${BS}*core${BS}* team, cost ${BS}- benefit"}`);
    expect(r.summary).toBe(`Led the ${BS}*core${BS}* team, cost ${BS}- benefit`);
  });
  it('repairs a literal backslash carried over from CV text', () => {
    const r = extractJson(`{"headline":"TCP${BS}IP engineer, 24${BS}7 support"}`);
    expect(r.headline).toBe(`TCP${BS}IP engineer, 24${BS}7 support`);
  });
  it('repairs a Windows path with backslashes', () => {
    const r = extractJson(`{"summary":"stored in C:${BS}Users${BS}docs"}`);
    expect(r.summary).toBe(`stored in C:${BS}Users${BS}docs`);
  });
  it('preserves valid escapes while repairing invalid ones', () => {
    const r = extractJson(`{"summary":"line1${BS}nreal quote ${BS}" and stray ${BS}z"}`);
    expect(r.summary).toBe(`line1\nreal quote " and stray ${BS}z`);
  });
});

describe('parseCvText', () => {
  it('returns the structured object from the engine response', async () => {
    const engine = { generate: async () => '```json\n{"fullName":"Jane Doe","skills":["Node"]}\n```' };
    const result = await parseCvText('Jane Doe, Node developer', engine);
    expect(result.fullName).toBe('Jane Doe');
    expect(result.skills).toEqual(['Node']);
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'sorry I cannot help' };
    await expect(parseCvText('x', engine)).rejects.toThrow(/Could not understand/);
  });
});
