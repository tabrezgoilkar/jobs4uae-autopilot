// Dependency-free PDF writer for CV export.
//
// Why this instead of Puppeteer/Playwright: the cloud (Vercel serverless) build
// must NOT bundle Playwright (see cloudApp.js). Generating a real, selectable-text
// PDF with only Node built-ins keeps the route cloud-safe AND gives the user a
// true "download" (not a browser print dialog).
//
// Scope: clean text layout (name, contact, divider, sections with headings,
// bold sub-headings, bullet lines), automatic pagination. No images/tables.

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;

// Approximate Helvetica average advance widths (1000-unit em) — good enough for
// wrapping without pulling in a full glyph-metrics table.
const CHAR_W = { ' ': 278, 'f': 278, 'i': 278, 'l': 278, 'I': 278, 'r': 333, 't': 278, ',': 278, '.': 278, '!': 278, ';': 278, ':': 278, "'": 278, '"': 355, '(': 333, ')': 333, '[': 278, ']': 278, '{': 278, '}': 278, '-': 333, '+': 573, '=': 573, '*': 500, '/': 278, '\\': 278, 'j': 222, 'J': 500, 'z': 500, 'Z': 556, 'm': 833, 'w': 833, 'M': 833, 'W': 944, 'm': 833 };
function charWidth(ch, bold) {
  let w = CHAR_W[ch];
  if (w == null) w = /[A-Z0-9]/.test(ch) ? 667 : 500;
  return (bold ? w * 1.02 : w) / 1000;
}
function measure(text, size, bold) {
  let w = 0;
  for (const ch of String(text)) w += charWidth(ch, bold) * size;
  return w;
}
function wrap(text, size, bold, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (measure(trial, size, bold) > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function escPdf(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Filled circle path (4 Bézier arcs) — used for PDF bullets so we don't depend
// on a font glyph for the "•" (which mis-encodes under WinAnsiEncoding).
function dotPath(cx, cy, r) {
  const k = 0.5523;
  return (
    `q 0 0 0 rg ${cx.toFixed(2)} ${(cy - r).toFixed(2)} m ` +
    `${(cx + r * k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx + r.toFixed(2)} ${(cy - r * k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c ` +
    `${(cx + r).toFixed(2)} ${(cy + r * k).toFixed(2)} ${(cx + r * k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c ` +
    `${(cx - r * k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + r * k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c ` +
    `${(cx - r).toFixed(2)} ${(cy - r * k).toFixed(2)} ${(cx - r * k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c f Q`
  );
}

export class PdfDoc {
  constructor() {
    this.pages = [[]]; // each page: array of content-op strings
    this.y = PAGE_H - MARGIN_TOP;
    this.pageNo = 0;
  }
  _content() { return this.pages[this.pages.length - 1]; }
  newPage() {
    this.pages.push([]);
    this.y = PAGE_H - MARGIN_TOP;
  }
  _ensure(space) {
    if (this.y - space < MARGIN_BOTTOM) this.newPage();
  }
  /** Draw text at current cursor (top-down). Returns the new y. */
  text(str, { size = 10, bold = false, color = [0, 0, 0], indent = 0, gap = 2, leading = 0 } = {}) {
    const font = bold ? 'F2' : 'F1';
    const [r, g, b] = color;
    const x = MARGIN_X + indent;
    const lines = wrap(str, size, bold, PAGE_W - MARGIN_X - x);
    for (const ln of lines) {
      this._ensure(size + gap);
      this.y -= size;
      this._content().push(
        `q ${r} ${g} ${b} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${this.y.toFixed(2)} Tm (${escPdf(ln)}) Tj ET Q`,
      );
      this.y -= gap + leading;
    }
    return this.y;
  }
  heading(str, { size = 13, gap = 4 } = {}) {
    this._ensure(size + gap + 6);
    this.y -= size + 2;
    this._content().push(
      `q 0.10 0.24 0.43 rg BT /F2 ${size} Tf 1 0 0 1 ${MARGIN_X.toFixed(2)} ${this.y.toFixed(2)} Tm (${escPdf(str)}) Tj ET Q`,
    );
    this.y -= 4;
    // divider rule
    const yLine = this.y + 2;
    this._content().push(`q 0.79 0.85 0.93 RG 0.6 w ${MARGIN_X.toFixed(2)} ${yLine.toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${yLine.toFixed(2)} l S Q`);
    this.y -= gap;
    return this.y;
  }
  rule() {
    this._ensure(8);
    const yLine = this.y;
    this._content().push(`q 0.30 0.30 0.35 RG 0.8 w ${MARGIN_X.toFixed(2)} ${yLine.toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${yLine.toFixed(2)} l S Q`);
    this.y -= 8;
  }
  /**
   * A bullet line with a small drawn dot (not a font glyph) so it renders as a
   * real "•" in every viewer. Text is wrapped and indented past the dot.
   */
  bullet(str, { size = 9.5, bold = false, indent = 10, gap = 1 } = {}) {
    const maxWidth = PAGE_W - MARGIN_X - (MARGIN_X + indent + 8);
    const lines = wrap(str, size, bold, maxWidth);
    for (const ln of lines) {
      this._ensure(size + gap);
      this.y -= size;
      const textY = this.y;
      // dot, vertically centered on the cap height
      const cx = MARGIN_X + indent + 2.5;
      const cy = textY + size * 0.34;
      const r = Math.max(0.9, size * 0.11);
      this._content().push(dotPath(cx, cy, r));
      const tx = MARGIN_X + indent + 8;
      this._content().push(
        `q BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${tx.toFixed(2)} ${textY.toFixed(2)} Tm (${escPdf(ln)}) Tj ET Q`,
      );
      this.y -= gap;
    }
    return this.y;
  }
  space(h = 6) { this.y -= h; }

  toBuffer() {
    const objects = []; // index 1-based
    const addObj = (body) => { objects.push(body); return objects.length; };

    const fontF1 = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontF2 = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const pageObjIds = [];
    const contentObjIds = [];
    for (const content of this.pages) {
      const stream = content.join('\n');
      const cid = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      contentObjIds.push(cid);
    }
    const pagesId = addObj(''); // placeholder
    this.pages.forEach((_, i) => {
      const cid = contentObjIds[i];
      const pid = addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> /Contents ${cid} 0 R >>`);
      pageObjIds.push(pid);
    });
    const kids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    offsets.forEach((off) => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }
}

export const PDF_PAGE = { W: PAGE_W, H: PAGE_H, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM, measure, wrap };
