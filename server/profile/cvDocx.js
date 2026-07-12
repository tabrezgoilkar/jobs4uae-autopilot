import { zipSync } from '../lib/zip.js';
import { profileToCvSections } from './cvSections.js';

const xmlEsc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Real bullet definition. Without a numbering part Word falls back to numbering
// each paragraph 1,2,3… — so bullets must be explicitly defined here.
const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0" w:nsid="07B85160" w:tmpl="37A314B6" w:multiLevelType="hybridMultilevel">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#8226;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

/** Build a WordprocessingML <w:body> from CV sections. */
function bodyXml(cv) {
  const parts = [];
  const para = (text, opts = {}) => {
    const bold = opts.bold ? '<w:b/>' : '';
    const size = opts.size ? `<w:sz w:val="${opts.size * 2}"/><w:szCs w:val="${opts.size * 2}"/>` : '';
    const color = opts.color ? `<w:color w:val="${opts.color}"/>` : '';
    const spacing = opts.spaceAfter != null ? `<w:spacing w:after="${opts.spaceAfter}"/>` : '';
    parts.push(
      `<w:p><w:pPr>${spacing}</w:pPr><w:r><w:rPr>${bold}${size}${color}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`,
    );
  };
  const heading = (text, opts = {}) => {
    const color = opts.color || '1A3C6E';
    parts.push(
      `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="C9D8EE"/></w:pBdr></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`,
    );
  };
  const bullet = (text) => {
    parts.push(
      `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`,
    );
  };

  para(cv.name, { bold: true, size: 22, spaceAfter: 20 });
  if (cv.headline) para(cv.headline, { color: '1A3C6E', size: 13, spaceAfter: 20 });
  if (cv.contact) para(cv.contact, { color: '444444', size: 10, spaceAfter: 80 });

  for (const sec of cv.sections) {
    heading(sec.title);
    for (const item of sec.items) {
      if (item.heading) para(item.heading, { bold: true, size: 12, spaceAfter: 20 });
      if (item.sub) para(item.sub, { color: '595959', size: 10, spaceAfter: 20 });
      if (item.body) para(item.body, { size: 11, spaceAfter: 20 });
      for (const b of item.bullets || []) bullet(b);
    }
  }
  return parts.join('');
}

function documentXml(cv) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml(cv)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

/**
 * Render a profile to a valid .docx (Word) Buffer — no external deps.
 * Cloud-safe (Node built-ins only). Returns a Buffer.
 * @param {object} profile
 * @returns {Buffer}
 */
export function renderProfileCvDocx(profile) {
  const cv = profileToCvSections(profile);
  const files = [
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
        'utf8',
      ),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
        'utf8',
      ),
    },
    {
      // CRITICAL: document.xml must reference numbering.xml via a relationship
      // of type "numbering". Without word/_rels/document.xml.rels Word cannot
      // resolve <w:numId w:val="1"/> and silently falls back to auto-numbering
      // (1, 2, 3…) instead of rendering the bullet dot. This is the actual fix
      // for "Word shows numbers instead of bullets".
      name: 'word/_rels/document.xml.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
        'utf8',
      ),
    },
    {
      name: 'word/numbering.xml',
      data: Buffer.from(NUMBERING_XML, 'utf8'),
    },
    {
      name: 'word/document.xml',
      data: Buffer.from(documentXml(cv), 'utf8'),
    },
  ];
  return zipSync(files);
}
