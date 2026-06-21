export type PdfKind = 'resume' | 'cover';

/**
 * Download a generated PDF for a document.
 * Triggers a browser file download via a temporary <a download> element.
 */
export async function downloadPdf(docId: string, kind: PdfKind): Promise<void> {
  const res = await fetch(`/api/documents/${docId}/pdf?kind=${kind}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const filename = kind === 'resume' ? `resume-${docId}.pdf` : `cover-letter-${docId}.pdf`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke the object URL after a short delay to allow the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
