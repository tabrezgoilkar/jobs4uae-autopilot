import { marked } from 'marked';

/**
 * Build a full HTML document for a UAE/GCC-style resume PDF.
 * Personal Details rows are only rendered if the value exists on the profile.
 */
export function resumeHtml(profile, resumeMarkdown) {
  const { fullName = '', email = '', phone = '', location = '' } = profile ?? {};

  // Contact line: join non-empty parts
  const contactParts = [email, phone, location].filter(Boolean);
  const contactLine = contactParts.join(' · ');

  // Personal Details: only render rows that have a value
  const personalRows = [
    ['Nationality',     profile?.nationality],
    ['Visa status',     profile?.visaStatus],
    ['Notice period',   profile?.noticePeriod],
    ['Languages',       profile?.languages],
    ['Driving licence', profile?.drivingLicence],
  ]
    .filter(([, val]) => val != null && String(val).trim() !== '')
    .map(([label, val]) => `
      <tr>
        <td class="pd-label">${escHtml(label)}</td>
        <td class="pd-value">${escHtml(String(val))}</td>
      </tr>`)
    .join('');

  const personalDetailsBlock = personalRows
    ? `<section class="personal-details">
        <h2>Personal Details</h2>
        <table>
          <tbody>${personalRows}</tbody>
        </table>
      </section>`
    : '';

  const bodyHtml = marked.parse(resumeMarkdown ?? '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escHtml(fullName)} — Resume</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.5;
  }
  header {
    padding-bottom: 12px;
    border-bottom: 2px solid #1a3c6e;
    margin-bottom: 16px;
  }
  header h1 {
    font-size: 22pt;
    color: #1a3c6e;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  header .contact {
    font-size: 9.5pt;
    color: #444;
    margin-top: 4px;
  }
  .personal-details {
    margin-bottom: 16px;
    background: #f5f7fa;
    border-radius: 4px;
    padding: 10px 14px;
  }
  .personal-details h2 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1a3c6e;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .personal-details table {
    border-collapse: collapse;
    width: 100%;
  }
  .pd-label {
    font-weight: 600;
    color: #333;
    width: 38%;
    padding: 2px 8px 2px 0;
    font-size: 9.5pt;
    vertical-align: top;
  }
  .pd-value {
    color: #222;
    font-size: 9.5pt;
    vertical-align: top;
  }
  .body-content h1, .body-content h2, .body-content h3 {
    color: #1a3c6e;
    margin-top: 14px;
    margin-bottom: 4px;
  }
  .body-content h1 { font-size: 13pt; border-bottom: 1px solid #c9d8ee; padding-bottom: 3px; }
  .body-content h2 { font-size: 11.5pt; }
  .body-content h3 { font-size: 10.5pt; }
  .body-content ul { padding-left: 18px; margin-top: 4px; }
  .body-content li { margin-bottom: 2px; }
  .body-content p { margin-top: 4px; }
  .body-content strong { color: #111; }
  @media print {
    body { font-size: 10.5pt; }
    header h1 { font-size: 20pt; }
    .personal-details { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <header>
    <h1>${escHtml(fullName)}</h1>
    ${contactLine ? `<p class="contact">${escHtml(contactLine)}</p>` : ''}
  </header>
  ${personalDetailsBlock}
  <div class="body-content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/**
 * Build a full HTML document for a cover letter PDF.
 */
export function coverLetterHtml(profile, coverLetterMarkdown) {
  const { fullName = '', email = '', phone = '', location = '' } = profile ?? {};

  const contactParts = [email, phone, location].filter(Boolean);
  const contactLine = contactParts.join(' · ');

  const bodyHtml = marked.parse(coverLetterMarkdown ?? '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escHtml(fullName)} — Cover Letter</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.6;
  }
  header {
    padding-bottom: 12px;
    border-bottom: 2px solid #1a3c6e;
    margin-bottom: 20px;
  }
  header h1 {
    font-size: 20pt;
    color: #1a3c6e;
    font-weight: 700;
  }
  header .contact {
    font-size: 9.5pt;
    color: #444;
    margin-top: 4px;
  }
  .body-content p { margin-top: 10px; }
  .body-content h1, .body-content h2, .body-content h3 {
    color: #1a3c6e;
    margin-top: 14px;
    margin-bottom: 4px;
  }
  @media print {
    body { font-size: 10.5pt; }
  }
</style>
</head>
<body>
  <header>
    <h1>${escHtml(fullName)}</h1>
    ${contactLine ? `<p class="contact">${escHtml(contactLine)}</p>` : ''}
  </header>
  <div class="body-content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/** Minimal HTML entity escaping to avoid XSS in the template. */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
