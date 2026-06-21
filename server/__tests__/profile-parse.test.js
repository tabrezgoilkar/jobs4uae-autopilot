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
