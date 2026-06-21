import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe('extractText', () => {
  it('reads plain text files directly', async () => {
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('Hello CV'), 'resume.txt');
    expect(out).toBe('Hello CV');
  });

  it('throws a friendly error for unsupported types', async () => {
    const { extractText } = await import('../profile/extract.js');
    await expect(extractText(Buffer.from('x'), 'resume.png')).rejects.toThrow(/Unsupported/);
  });

  it('uses pdf-parse for .pdf files', async () => {
    vi.doMock('pdf-parse', () => ({ default: vi.fn(async () => ({ text: 'PDF TEXT' })) }));
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('%PDF'), 'resume.pdf');
    expect(out).toBe('PDF TEXT');
  });

  it('uses mammoth for .docx files', async () => {
    vi.doMock('mammoth', () => ({ default: { extractRawText: vi.fn(async () => ({ value: 'DOCX TEXT' })) } }));
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('PK'), 'resume.docx');
    expect(out).toBe('DOCX TEXT');
  });
});
