import { describe, test, expect, vi } from 'vitest';

// Pure ATS check — no AI involved.
const { runAtsCheck } = await import('../apply/atsCheck.js');
const { draftApplication } = await import('../apply/drafter.js');
const { reviewApplication } = await import('../apply/reviewer.js');

describe('runAtsCheck (honest, no AI)', () => {
  const resume = `# John Doe
john@example.com

## Summary
Backend engineer.

## Experience
Built APIs with Node.js.

## Skills
TypeScript, AWS

## Education
BSc Computer Science`;

  test('parses standard sections and flags parser-safe when contact info present', () => {
    const r = runAtsCheck({ resumeMarkdown: resume, jobText: 'Need Node.js' });
    // Section names keep the heading's original case.
    expect(r.sections).toEqual(expect.arrayContaining(['Summary', 'Experience', 'Skills', 'Education']));
    expect(r.atsReadable).toBe(true); // email present near top => contact detected
  });

  test('reports present vs missing keywords from the job', () => {
    const r = runAtsCheck({ resumeMarkdown: resume, jobText: 'We need Node.js and Kubernetes and Python' });
    expect(r.presentKeywords).toContain('node.js');
    expect(r.missingKeywords).toEqual(expect.arrayContaining(['kubernetes', 'python']));
  });

  test('flags missing core sections', () => {
    const r = runAtsCheck({ resumeMarkdown: '# No structure here\njust text', jobText: 'x' });
    expect(r.warnings.join(' ')).toMatch(/Missing standard section/i);
    expect(r.atsReadable).toBe(false);
  });

  test('flags tables/images as not parser-safe', () => {
    const r = runAtsCheck({ resumeMarkdown: '## Skills\n| a | b |\n|---|---|\n| 1 | 2 |', jobText: 'x' });
    expect(r.atsReadable).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/tables|images/i);
  });
});

describe('draftApplication (drafter)', () => {
  test('extracts resume/cover/rationale from the model JSON', async () => {
    const engine = { generate: vi.fn(async () => JSON.stringify({
      resumeMarkdown: 'R', coverLetterMarkdown: 'C', rationale: 'because',
    })) };
    const out = await draftApplication({ profile: {}, jobText: 'job', engine });
    expect(out.resumeMarkdown).toBe('R');
    expect(out.coverLetterMarkdown).toBe('C');
    expect(out.rationale).toBe('because');
    expect(engine.generate).toHaveBeenCalledOnce();
  });

  test('throws a clear error if the model returns no JSON', async () => {
    const engine = { generate: vi.fn(async () => 'no json here') };
    await expect(draftApplication({ profile: {}, jobText: 'job', engine })).rejects.toThrow(/no usable JSON/i);
  });
});

describe('reviewApplication (reviewer)', () => {
  test('approves when honesty is high and no fabrication', async () => {
    const engine = { generate: vi.fn(async () => JSON.stringify({
      honestyScore: 95, approved: true, issues: ['Looks truthful.'],
    })) };
    const out = await reviewApplication({ profile: {}, jobText: 'j', draft: { resumeMarkdown: 'r', coverLetterMarkdown: 'c' }, engine });
    expect(out.honestyScore).toBe(95);
    expect(out.approved).toBe(true);
  });

  test('rejects (does not auto-approve) when a fabrication issue is present', async () => {
    const engine = { generate: vi.fn(async () => JSON.stringify({
      honestyScore: 90, approved: true, issues: ['Fabricated: claims Kubernetes experience not in profile.'],
    })) };
    const out = await reviewApplication({ profile: {}, jobText: 'j', draft: { resumeMarkdown: 'r', coverLetterMarkdown: 'c' }, engine });
    expect(out.approved).toBe(false); // fabrication => fail safe
  });

  test('fails safe (not approved) if the reviewer returns no JSON', async () => {
    const engine = { generate: vi.fn(async () => 'garbage') };
    const out = await reviewApplication({ profile: {}, jobText: 'j', draft: { resumeMarkdown: 'r', coverLetterMarkdown: 'c' }, engine });
    expect(out.approved).toBe(false);
    expect(out.honestyScore).toBe(0);
  });
});
