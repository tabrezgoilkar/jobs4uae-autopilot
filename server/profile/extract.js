import path from 'node:path';

export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  if (ext === '.txt' || ext === '.md') {
    return buffer.toString('utf8');
  }

  if (ext === '.pdf') {
    const mod = await import('pdf-parse');
    const pdfParse = mod.default ?? mod;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const mod = await import('mammoth');
    const mammoth = mod.default ?? mod;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type "${ext || 'unknown'}". Please upload a PDF, Word (.docx), or text file.`);
}
