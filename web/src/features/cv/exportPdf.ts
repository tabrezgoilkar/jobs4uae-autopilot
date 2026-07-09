// Export the CV as PDF by printing it inside an isolated iframe document.
//
// Why not just window.print() the modal? The CV preview lives inside a
// `position: fixed` modal with an `overflow-y-auto` scroll container, and the
// old print CSS made `.cv-print` `position: absolute`. Browsers do NOT paginate
// absolutely-positioned / fixed / clipped content across printed pages — they
// render only what fits on page 1 and drop the rest (the "page 2 missing" bug).
//
// An isolated iframe has no such ancestors: the CV is a normal in-flow block at
// the document root, so the browser paginates it naturally across as many pages
// as needed. The templates use inline styles, so no app CSS needs copying — we
// only add page margins and force background colours (Modern's coloured header /
// sidebar) to print.

export function cvPrintDocument(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>CV</title><style>
  @page { margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${bodyHtml}</body></html>`;
}

export function exportCvToPdf(node: HTMLElement | null): void {
  if (!node) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    if (iframe.isConnected) iframe.remove();
  };
  win.addEventListener('afterprint', cleanup);

  doc.open();
  doc.write(cvPrintDocument(node.innerHTML));
  doc.close();

  // Let the isolated document lay out, then print. print() blocks in
  // Chromium/Firefox (afterprint then cleans up); the timeout is the
  // Safari/async fallback so the hidden iframe never lingers.
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(cleanup, 5000);
  }, 200);
}
