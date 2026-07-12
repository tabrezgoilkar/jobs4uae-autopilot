import { useRef, useState } from 'react';
import type { Profile } from '../../api';
import { downloadProfilePdf, downloadProfileDocx } from '../../api';
import { CvDocument } from './CvTemplates';
import { CV_TEMPLATES, type CvTemplateId } from './cvTypes';
import { exportCvToPdf } from './exportPdf';

// Full-screen CV preview + export. Export prints the CV inside an isolated
// iframe (see exportPdf.ts) so long CVs paginate across multiple pages — the
// in-modal window.print() clipped everything after page 1.
export default function CvExportModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [template, setTemplate] = useState<CvTemplateId>('classic');
  const [busy, setBusy] = useState<'' | 'pdf' | 'docx'>('');
  const cvRef = useRef<HTMLDivElement>(null);

  async function handleDownload(kind: 'pdf' | 'docx') {
    setBusy(kind);
    try {
      if (kind === 'pdf') await downloadProfilePdf();
      else await downloadProfileDocx();
    } catch {
      // surface a gentle failure; the print option remains as a fallback
      alert('Download failed. You can still use "Print to PDF" below.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Export CV" className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'var(--surface-sunken)' }}>
      {/* toolbar (hidden when printing) */}
      <div className="cv-toolbar flex-none flex items-center gap-2 px-3 sm:px-5 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}>
        <button onClick={onClose} aria-label="Close" className="j4u-chip w-9 h-9 flex items-center justify-center rounded-md border border-hair text-ink-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="flex gap-1.5 ml-1 overflow-x-auto">
          {CV_TEMPLATES.map((t) => {
            const active = template === t.id;
            return (
              <button key={t.id} onClick={() => setTemplate(t.id)} className="j4u-press flex-none text-[12.5px] font-semibold rounded-md px-3 h-9 whitespace-nowrap"
                style={active ? { background: 'var(--primary-600)', color: '#fff', border: 'none' } : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t.name}</button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => handleDownload('docx')} disabled={!!busy} className="j4u-press inline-flex items-center gap-2 text-ink-secondary text-[12.5px] font-semibold rounded-md px-3 h-9" style={{ border: '1px solid var(--border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></svg>
            {busy === 'docx' ? 'Preparing…' : 'Word'}
          </button>
          <button onClick={() => handleDownload('pdf')} disabled={!!busy} className="j4u-press inline-flex items-center gap-2 text-white text-[12.5px] font-semibold rounded-md px-4 h-9" style={{ background: 'var(--ai-600)', border: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
            {busy === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center">
        <div ref={cvRef} className="cv-print shadow-lg" style={{ background: '#fff', width: '100%', maxWidth: 794, alignSelf: 'flex-start' }}>
          <CvDocument profile={profile} template={template} />
        </div>
      </div>

      <div className="flex-none px-3 sm:px-5 py-2.5 border-t text-[12px] text-ink-muted flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}>
        <span>Download uses a real, formatted file (no print dialog).</span>
        <button onClick={() => exportCvToPdf(cvRef.current)} className="j4u-chip ml-auto inline-flex items-center gap-1.5 text-ink-secondary font-semibold rounded-md px-3 h-8" style={{ border: '1px solid var(--border)' }}>
          Print to PDF…
        </button>
      </div>
    </div>
  );
}
