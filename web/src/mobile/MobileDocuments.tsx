import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { generateDocuments, saveDocument, listDocuments, type DocumentRecord } from '../api';
import { downloadPdf } from '../features/pdf/pdfApi';

function renderMd(text: string) {
  return DOMPurify.sanitize(marked.parse(text || '', { async: false }) as string);
}
const STARS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

interface Doc { id: string | null; jobTitle: string; company: string; resume: string; cover: string; fitScore: string; missingSkills: string[] }

export default function MobileDocuments() {
  const [recent, setRecent] = useState<DocumentRecord[]>([]);
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'resume' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [tab, setTab] = useState<'resume' | 'cover'>('resume');

  const refresh = () => listDocuments().then(setRecent).catch(() => {});
  useEffect(() => { refresh(); }, []);

  async function onGenerate() {
    if (!jobText.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const d = await generateDocuments({ jobText: jobText.trim() });
      const payload = { jobTitle: d.jobTitle ?? '', company: d.company ?? '', resumeMarkdown: d.resumeMarkdown, coverLetterMarkdown: d.coverLetterMarkdown, baseResumeMarkdown: d.baseResumeMarkdown ?? '', rationale: d.rationale ?? '', fitScore: d.fitScore, missingSkills: d.missingSkills ?? [] };
      const saved = await saveDocument(payload);
      setDoc({ id: saved.id, jobTitle: saved.jobTitle ?? '', company: saved.company ?? '', resume: d.resumeMarkdown, cover: d.coverLetterMarkdown, fitScore: d.fitScore, missingSkills: d.missingSkills ?? [] });
      setTab('resume'); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not tailor your documents.'); }
    finally { setBusy(false); }
  }

  function openDoc(d: DocumentRecord) {
    setDoc({ id: d.id, jobTitle: d.jobTitle ?? '', company: d.company ?? '', resume: d.resumeMarkdown, cover: d.coverLetterMarkdown, fitScore: d.fitScore ?? '', missingSkills: d.missingSkills ?? [] });
    setTab('resume'); setError(null);
  }
  async function pdf(kind: 'resume' | 'cover') {
    if (!doc?.id) return;
    setPdfBusy(kind);
    try { await downloadPdf(doc.id, kind); } catch (e) { setError(e instanceof Error ? e.message : 'Download failed.'); }
    finally { setPdfBusy(null); }
  }

  const card = { background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 14 } as const;

  // ---- result view ----
  if (doc) {
    const filled = STARS[(doc.fitScore || 'C').toUpperCase()] ?? 3;
    const body = tab === 'resume' ? doc.resume : doc.cover;
    return (
      <div className="j4u-rise space-y-3">
        <button onClick={() => setDoc(null)} className="text-[12.5px] font-semibold" style={{ color: 'var(--primary-700)' }}>← New / all documents</button>
        {doc.fitScore && (
          <div className="flex items-center gap-3" style={{ ...card, padding: '14px 16px' }}>
            <div className="text-[26px] leading-none" style={{ color: '#6B45F0' }}>{'★'.repeat(filled)}<span style={{ color: '#D7CCF5' }}>{'★'.repeat(5 - filled)}</span></div>
            <div className="flex-1"><div className="text-[13.5px] font-bold" style={{ color: 'var(--text-strong)' }}>{filled} / 5 · grade {doc.fitScore}</div><div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{[doc.jobTitle, doc.company].filter(Boolean).join(' · ') || 'After tailoring'}</div></div>
          </div>
        )}
        <div className="flex gap-[3px] p-[3px]" style={{ background: 'var(--surface-sunken)', borderRadius: 10 }}>
          {(['resume', 'cover'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 text-[12px] font-semibold py-1.5" style={{ borderRadius: 7, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--text-strong)' : 'var(--text-muted)', border: 'none' }}>{t === 'resume' ? 'CV' : 'Cover'}</button>
          ))}
        </div>
        <div style={{ ...card, overflow: 'hidden' }}><div className="j4u-doc" style={{ padding: 16, fontSize: 12.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: renderMd(body) }} /></div>
        {doc.missingSkills.length > 0 && (
          <div style={{ ...card, padding: '14px 16px' }}>
            <div className="text-[10.5px] font-bold uppercase mb-2" style={{ letterSpacing: '0.06em', color: 'var(--warning-text)' }}>Still worth adding</div>
            <div className="flex flex-wrap gap-1.5">{doc.missingSkills.map((s, i) => <span key={i} className="text-[11.5px] font-medium" style={{ padding: '3px 9px', borderRadius: 9999, background: '#FCEFD6', color: '#92560A' }}>{s}</span>)}</div>
          </div>
        )}
        {error && <p role="alert" className="text-[12.5px] rounded-md p-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>{error}</p>}
        <div className="flex flex-col gap-2">
          <button onClick={() => pdf('resume')} disabled={pdfBusy === 'resume'} className="j4u-press inline-flex items-center justify-center gap-2 text-white text-[13.5px] font-semibold disabled:opacity-60" style={{ height: 46, borderRadius: 12, background: 'var(--primary-600)', border: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{pdfBusy === 'resume' ? 'Generating…' : 'Download CV PDF'}
          </button>
          <button onClick={() => pdf('cover')} disabled={pdfBusy === 'cover'} className="j4u-press inline-flex items-center justify-center gap-2 text-[13px] font-semibold disabled:opacity-60" style={{ height: 44, borderRadius: 12, background: 'var(--ai-soft)', color: 'var(--ai-700)', border: '1px solid #E0D5FB' }}>{pdfBusy === 'cover' ? 'Generating…' : 'Download cover letter PDF'}</button>
        </div>
      </div>
    );
  }

  // ---- input + recent view ----
  return (
    <div className="j4u-rise space-y-3.5">
      <div style={{ ...card, padding: 16 }}>
        <div className="text-[14px] font-bold" style={{ color: 'var(--text-strong)' }}>Tailor my CV &amp; cover letter</div>
        <div className="text-[12px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>Paste a job description — I'll tailor your CV and write a cover letter, honestly.</div>
        <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} rows={6} placeholder="Paste the job description here…" className="w-full text-sm" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface)', color: 'var(--text)' }} />
        {error && <p role="alert" className="text-[12.5px] rounded-md p-2.5 mt-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>{error}</p>}
        <button onClick={onGenerate} disabled={busy || !jobText.trim()} className="j4u-press w-full mt-3 inline-flex items-center justify-center gap-2 text-white text-[13.5px] font-semibold disabled:opacity-60" style={{ height: 46, borderRadius: 12, background: 'var(--ai-600)', border: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>{busy ? 'Tailoring…' : 'Tailor my CV'}
        </button>
      </div>

      {recent.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div className="px-4 py-3 text-[13px] font-bold border-b" style={{ color: 'var(--text-strong)', borderColor: 'var(--border-subtle)' }}>Your documents</div>
          {recent.map((d, i) => (
            <button key={d.id} onClick={() => openDoc(d)} className="j4u-tap w-full text-left flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < recent.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span className="flex-none flex items-center justify-center text-[13px] font-bold" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-700)' }}>{d.fitScore || '·'}</span>
              <span className="flex-1 min-w-0"><span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--text-strong)' }}>{d.jobTitle || 'Tailored CV'}</span><span className="block text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>{d.company || 'Tap to open'}</span></span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
