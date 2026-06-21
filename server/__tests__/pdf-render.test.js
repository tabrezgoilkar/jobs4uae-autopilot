import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/browser.js', () => ({
  renderPdfFromHtml: vi.fn(async () => Buffer.from('FAKE-PDF')),
}));

describe('renderResumePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Buffer', async () => {
    const { renderResumePdf } = await import('../documents/pdf/render.js');
    const profile = { fullName: 'Jane Al-Rashidi', email: 'j@example.com' };
    const result = await renderResumePdf(profile, '# Work\nDid things');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('calls renderPdfFromHtml with HTML containing the candidate name', async () => {
    const { renderPdfFromHtml } = await import('../lib/browser.js');
    const { renderResumePdf } = await import('../documents/pdf/render.js');
    const profile = { fullName: 'Jane Al-Rashidi' };
    await renderResumePdf(profile, '# Work');
    expect(renderPdfFromHtml).toHaveBeenCalledOnce();
    const [html] = renderPdfFromHtml.mock.calls[0];
    expect(html).toContain('Jane Al-Rashidi');
  });

  it('HTML passed to renderPdfFromHtml contains Personal Details when profile has nationality', async () => {
    const { renderPdfFromHtml } = await import('../lib/browser.js');
    const { renderResumePdf } = await import('../documents/pdf/render.js');
    const profile = { fullName: 'Ali Hassan', nationality: 'Emirati' };
    await renderResumePdf(profile, '');
    const [html] = renderPdfFromHtml.mock.calls[0];
    expect(html).toContain('Personal Details');
    expect(html).toContain('Emirati');
  });
});

describe('renderCoverLetterPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Buffer', async () => {
    const { renderCoverLetterPdf } = await import('../documents/pdf/render.js');
    const profile = { fullName: 'Jane Al-Rashidi' };
    const result = await renderCoverLetterPdf(profile, 'Dear Hiring Manager');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('calls renderPdfFromHtml with HTML containing the candidate name', async () => {
    const { renderPdfFromHtml } = await import('../lib/browser.js');
    const { renderCoverLetterPdf } = await import('../documents/pdf/render.js');
    const profile = { fullName: 'Fatima Al-Zahra' };
    await renderCoverLetterPdf(profile, 'Dear Sir/Madam');
    expect(renderPdfFromHtml).toHaveBeenCalledOnce();
    const [html] = renderPdfFromHtml.mock.calls[0];
    expect(html).toContain('Fatima Al-Zahra');
  });
});
