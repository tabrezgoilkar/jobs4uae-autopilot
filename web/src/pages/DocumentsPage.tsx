import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  generateDocuments,
  listDocuments,
  saveDocument,
  updateDocument,
  listEvaluations,
  type DocumentRecord,
  type Evaluation,
} from '../api';
import { gradeToStars, learningLinks } from '../lib/skills';
import { diffLines, type DiffLine } from '../lib/diff';
import DownloadButtons from '../features/pdf/DownloadButtons';
import { Card, PageHeader, Button } from '../components/ui';
import { RadialGauge } from '../components/charts';

type CvView = 'preview' | 'edit' | 'diff';

/** Renders the line-level diff between the profile baseline and the tailored CV. */
function DiffView({ diff, added, removed }: { diff: DiffLine[]; added: number; removed: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-hair-subtle text-[12px]">
        <span className="text-ink-muted">Compared to your profile CV — what tailoring changed:</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-success-soft border border-success-text/30" />
          {added} added
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-danger-text">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-danger-soft border border-danger-text/30" />
          {removed} removed
        </span>
      </div>
      {added === 0 && removed === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">
          The tailored CV matches your profile CV line-for-line — no changes to show.
        </p>
      ) : (
        <div className="px-3 py-3 font-mono text-[12.5px] leading-relaxed overflow-x-auto">
          {diff.map((line, i) => {
            const base = 'flex gap-2 px-2 py-0.5 rounded-[4px] whitespace-pre-wrap break-words';
            if (line.type === 'add') {
              return (
                <div key={i} className={`${base} bg-success-soft text-success-text`}>
                  <span aria-hidden="true" className="select-none opacity-60">+</span>
                  <span className="flex-1">{line.text || ' '}</span>
                </div>
              );
            }
            if (line.type === 'remove') {
              return (
                <div key={i} className={`${base} bg-danger-soft text-danger-text`}>
                  <span aria-hidden="true" className="select-none opacity-60">−</span>
                  <span className="flex-1 line-through decoration-danger-text/40">{line.text || ' '}</span>
                </div>
              );
            }
            return (
              <div key={i} className={`${base} text-ink-muted`}>
                <span aria-hidden="true" className="select-none opacity-30">&nbsp;</span>
                <span className="flex-1">{line.text || ' '}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FIELD = 'mt-1 w-full rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const GRADE_PCT: Record<string, number> = { A: 92, B: 82, C: 68, D: 52, F: 35 };

function renderMd(md: string): string {
  // The CV/cover markdown is AI-generated, so sanitize before rendering.
  const html = marked.parse(md || '', { async: false }) as string;
  return DOMPurify.sanitize(html);
}

export default function DocumentsPage() {
  const [params] = useSearchParams();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [evalId, setEvalId] = useState<string>(params.get('eval') ?? '');
  const [jobText, setJobText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [resume, setResume] = useState('');
  const [cover, setCover] = useState('');
  const [baseResume, setBaseResume] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [fitScore, setFitScore] = useState('');
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<DocumentRecord[]>([]);
  const [tab, setTab] = useState<'resume' | 'cover'>('resume');
  const [view, setView] = useState<CvView>('preview');

  useEffect(() => {
    listEvaluations().then(setEvals).catch(() => {});
    listDocuments().then(setRecent).catch(() => {});
  }, []);

  const hasContent = !!(resume.trim() || cover.trim());

  async function onGenerate() {
    setBusy(true);
    setMessage(null);
    try {
      const body = evalId ? { evaluationId: evalId } : { jobText, jobTitle, company };
      const draft = await generateDocuments(body);
      setResume(draft.resumeMarkdown);
      setCover(draft.coverLetterMarkdown);
      setBaseResume(draft.baseResumeMarkdown ?? '');
      setJobTitle(draft.jobTitle);
      setCompany(draft.company);
      setFitScore(draft.fitScore);
      setMissingSkills(draft.missingSkills ?? []);
      setDocId(null);
      setView('preview');
      setTab('resume');
      setMessage({ ok: true, text: 'Documents generated! Review them, edit if needed, then Save.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Generation failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover, baseResumeMarkdown: baseResume, fitScore, missingSkills };
      const saved = docId ? await updateDocument(docId, payload) : await saveDocument(payload);
      setDocId(saved.id);
      setMessage({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not save. Please try again.' });
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }
    listDocuments().then(setRecent).catch(() => {});
  }

  function loadDoc(d: DocumentRecord) {
    setDocId(d.id);
    setJobTitle(d.jobTitle);
    setCompany(d.company);
    setEvalId(d.evaluationId ?? '');
    setResume(d.resumeMarkdown);
    setCover(d.coverLetterMarkdown);
    setBaseResume(d.baseResumeMarkdown ?? '');
    setFitScore(d.fitScore ?? '');
    setMissingSkills(d.missingSkills ?? []);
    setView('preview');
    setTab('resume');
    setMessage(null);
  }

  const activeValue = tab === 'resume' ? resume : cover;
  const setActiveValue = tab === 'resume' ? setResume : setCover;
  const fitPct = GRADE_PCT[(fitScore || '').toUpperCase()] ?? 0;
  const stars = gradeToStars(fitScore || 'C');

  // "What changed" diff — only meaningful on the CV tab when we have a baseline.
  const canDiff = tab === 'resume' && !!baseResume.trim();
  const diff = useMemo(() => (canDiff ? diffLines(baseResume, resume) : []), [canDiff, baseResume, resume]);
  const added = diff.filter((l) => l.type === 'add').length;
  const removed = diff.filter((l) => l.type === 'remove').length;
  // Guard: if we land on the cover tab while the diff view is active, show preview instead.
  const effectiveView: CvView = view === 'diff' && !canDiff ? 'preview' : view;

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Generate a tailored resume and cover letter, fine-tune them, and download as PDF." />

      {/* Generator */}
      <Card>
        <div className="space-y-3">
          {evals.length > 0 && (
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Use an evaluated job</span>
              <select className={FIELD} value={evalId} onChange={(e) => setEvalId(e.target.value)}>
                <option value="">— Paste a job instead —</option>
                {evals.map((ev) => (
                  <option key={ev.id} value={ev.id}>{(ev.jobTitle || 'Job')}{ev.company ? ` · ${ev.company}` : ''} ({ev.grade})</option>
                ))}
              </select>
            </label>
          )}
          {!evalId && (
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Or paste a job description</span>
              <textarea className="mt-1 w-full rounded-md border border-hair bg-surface text-ink p-3 text-sm j4u-focus placeholder:text-ink-muted" rows={4} value={jobText} disabled={busy} onChange={(e) => setJobText(e.target.value)} placeholder="Paste the job posting here…" />
            </label>
          )}
          <Button onClick={onGenerate} disabled={busy || (!evalId && !jobText.trim())}>
            {busy ? 'Writing…' : hasContent ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </Card>

      {message && (
        <div role="status" className={`text-sm rounded-md p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
          {message.text}
        </div>
      )}

      {hasContent && (
        <div className="grid lg:grid-cols-[1fr_300px] gap-[18px] items-start">
          {/* Document preview / editor */}
          <Card padding={false}>
            <div className="flex items-center gap-2 p-3 border-b border-hair-subtle">
              <div className="flex gap-1 bg-surface-sunken p-1 rounded-md">
                {(['resume', 'cover'] as const).map((t) => (
                  <button key={t} onClick={() => { setTab(t); if (t === 'cover' && view === 'diff') setView('preview'); }} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-sm j4u-press ${tab === t ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted'}`}>
                    {t === 'resume' ? 'Tailored CV' : 'Cover letter'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-1 bg-surface-sunken p-1 rounded-md">
                <button onClick={() => setView('preview')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press ${effectiveView === 'preview' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted'}`}>Preview</button>
                {canDiff && (
                  <button onClick={() => setView('diff')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press ${effectiveView === 'diff' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted'}`}>What changed</button>
                )}
                <button onClick={() => setView('edit')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press ${effectiveView === 'edit' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted'}`}>Edit</button>
              </div>
            </div>
            {effectiveView === 'edit' ? (
              <textarea
                aria-label={tab === 'resume' ? 'Resume content in Markdown' : 'Cover letter content in Markdown'}
                className="w-full border-0 bg-surface text-ink p-5 text-sm font-mono j4u-focus resize-none"
                rows={26}
                value={activeValue}
                disabled={saving}
                onChange={(e) => setActiveValue(e.target.value)}
              />
            ) : effectiveView === 'diff' ? (
              <DiffView diff={diff} added={added} removed={removed} />
            ) : (
              <div className="px-7 py-6 j4u-doc" dangerouslySetInnerHTML={{ __html: renderMd(activeValue) }} />
            )}
          </Card>

          {/* Right rail */}
          <div className="flex flex-col gap-3.5">
            {fitScore && (
              <Card>
                <div className="text-[11px] font-bold tracking-wide uppercase text-ink-muted mb-2">Fit after tailoring</div>
                <div className="flex items-center gap-3.5">
                  <RadialGauge value={fitPct} size={64} stroke={7} color="var(--ai-600)">
                    <span className="text-[13px] font-bold text-ink-strong">{fitScore}</span>
                  </RadialGauge>
                  <div>
                    <div className="text-warning text-lg leading-none" aria-label={`${stars} out of 5`}>
                      {'★'.repeat(stars)}<span className="text-hair">{'★'.repeat(5 - stars)}</span>
                    </div>
                    <div className="text-[11.5px] text-ink-secondary mt-1">{stars >= 4 ? 'Strong match for this role' : 'Decent — keep refining'}</div>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div className="text-[11px] font-bold tracking-wide uppercase text-warning-text mb-2.5">Still worth adding</div>
              {missingSkills.length === 0 ? (
                <p className="text-[12.5px] text-success-text">No major gaps — nicely tailored! 🎯</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {missingSkills.map((s) => (
                      <span key={s} className="text-xs px-2.5 py-0.5 rounded-pill bg-warning-soft text-warning-text font-medium">{s}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {missingSkills.slice(0, 3).map((s) => (
                      <a key={s} href={learningLinks(s)[0].url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-primary-700 hover:underline">Learn {s} free ↗</a>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : docId ? 'Update saved' : 'Save documents'}</Button>
            <DownloadButtons docId={docId} />
            <Button variant="ai" onClick={onGenerate} disabled={busy}>✨ Regenerate with copilot</Button>
            {!docId && <p className="text-[11px] text-ink-muted text-center">Save first to enable PDF download.</p>}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <Card title="Saved documents">
          <ul className="divide-y divide-hair-subtle -my-1">
            {recent.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-secondary truncate">{d.jobTitle || 'Documents'}{d.company ? ` · ${d.company}` : ''}</span>
                <button onClick={() => loadDoc(d)} aria-label={`Open documents for ${d.jobTitle || 'saved job'}`} className="text-sm font-semibold text-primary-700 j4u-focus rounded">Open</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
