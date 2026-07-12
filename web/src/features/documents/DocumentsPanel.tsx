import { useEffect, useMemo, useRef, useState } from 'react';
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
} from '../../api';
import { gradeToStars, learningLinks } from '../../lib/skills';
import { diffSections, type ChangeSegment } from '../../lib/wordDiff';
import DownloadButtons from '../pdf/DownloadButtons';
import { Card, Button } from '../../components/ui';
import { RadialGauge } from '../../components/charts';
import { IconSparkle } from '../../components/icons';

type CvView = 'final' | 'edit' | 'diff';

function Segs({ segments }: { segments: ChangeSegment[] }) {
  return (
    <p className="leading-relaxed whitespace-pre-wrap break-words text-[13px] text-ink">
      {segments.map((seg, j) => {
        if (seg.type === 'add') return <span key={j} className="rounded-[3px] bg-success-soft px-0.5 text-success-text">{seg.text}</span>;
        if (seg.type === 'remove') return <span key={j} className="rounded-[3px] bg-danger-soft px-0.5 text-danger-text line-through decoration-danger-text/50">{seg.text}</span>;
        return <span key={j}>{seg.text}</span>;
      })}
    </p>
  );
}

/** Word-level, section-grouped "what changed" — a Word-style amendment review. */
function AmendmentView({
  sections,
  rationale,
  changeCount,
  onRevert,
}: {
  sections: ReturnType<typeof diffSections>;
  rationale: string;
  changeCount: number;
  onRevert: () => void;
}) {
  const changed = sections.filter((s) => s.changed);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-hair-subtle">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ai-700">
          <IconSparkle size={13} color="var(--ai-600)" />
          {changeCount} change{changeCount !== 1 ? 's' : ''} the copilot made for this job
        </span>
        <span className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="text-success-text">insertions</span>
          <span className="text-danger-text line-through decoration-danger-text/50">deletions</span>
        </span>
      </div>
      {changed.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">No changes from your profile CV yet.</p>
      ) : (
        <div className="px-6 py-5 space-y-4">
          {changed.map((sec, i) => (
            <div key={i}>
              {sec.heading && <div className="text-[11px] font-bold uppercase tracking-wide text-primary-700 mb-1">{sec.heading}</div>}
              <Segs segments={sec.segments} />
            </div>
          ))}
        </div>
      )}
      {rationale && (
        <div className="px-6 py-4 border-t border-hair-subtle bg-ai-soft">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ai-700">
            <IconSparkle size={12} color="var(--ai-600)" /> Why — your copilot&apos;s reasoning
          </span>
          <p className="mt-1.5 text-[12.5px] text-ink leading-relaxed">{rationale}</p>
        </div>
      )}
      <div className="px-6 py-3 border-t border-hair-subtle flex justify-end">
        <button onClick={onRevert} className="text-[12px] font-semibold text-ink-muted hover:text-danger-text j4u-focus rounded-sm px-1.5 py-1 transition-colors">Revert all to my CV</button>
      </div>
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

/**
 * The CV/cover-letter tailoring experience, extracted so it can be embedded
 * inline (e.g. beneath an evaluation on the unified Evaluate page) rather than
 * living on its own route. When `evaluationId` is provided it auto-tailors for
 * that evaluated job on mount; otherwise the user picks an evaluated job or
 * pastes a description.
 */
export default function DocumentsPanel({ evaluationId }: { evaluationId?: string }) {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [evalId, setEvalId] = useState<string>(evaluationId ?? '');
  const [jobText, setJobText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [resume, setResume] = useState('');
  const [cover, setCover] = useState('');
  const [baseResume, setBaseResume] = useState('');
  const [rationale, setRationale] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [fitScore, setFitScore] = useState('');
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<DocumentRecord[]>([]);
  const [tab, setTab] = useState<'resume' | 'cover'>('resume');
  const [view, setView] = useState<CvView>('final');

  useEffect(() => {
    listEvaluations().then(setEvals).catch(() => {});
    listDocuments().then(setRecent).catch(() => {});
  }, []);

  // Arriving with an evaluationId (deep link / just-evaluated job) should
  // immediately tailor, not drop the user on the picker.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (evaluationId) {
      autoRan.current = true;
      onGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setRationale(draft.rationale ?? '');
      setJobTitle(draft.jobTitle);
      setCompany(draft.company);
      setFitScore(draft.fitScore);
      setMissingSkills(draft.missingSkills ?? []);
      setDocId(null);
      setView('final');
      setTab('resume');
      setMessage({ ok: true, text: 'Tailored by your copilot. Review the reasoning in "What changed", edit if needed, then Save.' });
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
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover, baseResumeMarkdown: baseResume, rationale, fitScore, missingSkills };
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
    setRationale(d.rationale ?? '');
    setFitScore(d.fitScore ?? '');
    setMissingSkills(d.missingSkills ?? []);
    setView('final');
    setTab('resume');
    setMessage(null);
  }

  const activeValue = tab === 'resume' ? resume : cover;
  const setActiveValue = tab === 'resume' ? setResume : setCover;
  const fitPct = GRADE_PCT[(fitScore || '').toUpperCase()] ?? 0;
  const stars = gradeToStars(fitScore || 'C');

  // "What changed" — word-level, section-grouped; only on the CV tab with a baseline.
  const canDiff = tab === 'resume' && !!baseResume.trim();
  const sections = useMemo(() => (canDiff ? diffSections(baseResume, resume) : []), [canDiff, baseResume, resume]);
  const changeCount = sections.filter((s) => s.changed).length;
  // Guard: if we land on the cover tab while the diff view is active, fall back.
  const effectiveView: CvView = view === 'diff' && !canDiff ? 'final' : view;

  return (
    <Card title="Tailor your CV & cover letter">
      <p className="text-sm text-ink-muted -mt-1 mb-3">Your copilot rewrites your CV + cover letter for this job, with its reasoning — then you fine-tune and download.</p>
      {/* Generator */}
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
          {busy ? 'Coaching your CV…' : hasContent ? 'Re-tailor' : 'Tailor my CV'}
        </Button>
      </div>

      {message && (
        <div role="status" className={`mt-3 text-sm rounded-md p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
          {message.text}
        </div>
      )}

      {hasContent && (
        <div className="mt-4 grid lg:grid-cols-[1fr_300px] gap-[18px] items-start">
          {/* Document preview / editor */}
          <Card padding={false}>
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-hair-subtle">
              <div className="flex gap-1 bg-surface-sunken p-1 rounded-md">
                {(['resume', 'cover'] as const).map((t) => (
                  <button key={t} onClick={() => { setTab(t); if (t === 'cover' && view === 'diff') setView('final'); }} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-sm j4u-press j4u-focus transition-colors ${tab === t ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}>
                    {t === 'resume' ? 'Tailored CV' : 'Cover letter'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-1 bg-surface-sunken p-1 rounded-md">
                <button onClick={() => setView('final')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press j4u-focus transition-colors ${effectiveView === 'final' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}>Final</button>
                {canDiff && (
                  <button onClick={() => setView('diff')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press j4u-focus transition-colors ${effectiveView === 'diff' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}>What changed</button>
                )}
                <button onClick={() => setView('edit')} className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-sm j4u-press j4u-focus transition-colors ${effectiveView === 'edit' ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}>Edit</button>
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
              <AmendmentView sections={sections} rationale={rationale} changeCount={changeCount} onRevert={() => { setResume(baseResume); setView('final'); }} />
            ) : (
              <div className="px-7 py-6 j4u-doc" dangerouslySetInnerHTML={{ __html: renderMd(activeValue) }} />
            )}
          </Card>

          {/* Right rail */}
          <div className="flex flex-col gap-3.5">
            {rationale && (
              <div className="j4u-grad-ai rounded-md p-4">
                <div className="flex items-center gap-1.5">
                  <IconSparkle size={14} color="var(--ai-600)" />
                  <span className="text-[11px] font-bold tracking-wide uppercase text-ai-700">Coach's note</span>
                </div>
                <p className="mt-2 text-[12.5px] text-ink leading-relaxed">{rationale}</p>
                {canDiff && <button onClick={() => setView('diff')} className="mt-2.5 text-[12px] font-semibold text-ai-700 hover:underline j4u-focus rounded-sm">See what changed →</button>}
              </div>
            )}

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
                <p className="text-[12.5px] text-success-text">No major gaps — nicely tailored.</p>
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
            <Button variant="ai" onClick={onGenerate} disabled={busy}><IconSparkle size={14} color="#fff" /> Re-tailor with copilot</Button>
            {!docId && <p className="text-[11px] text-ink-muted text-center">Save first to enable PDF download.</p>}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold tracking-wide uppercase text-ink-muted mb-2">Saved documents</div>
          <ul className="divide-y divide-hair-subtle -my-1">
            {recent.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-secondary truncate">{d.jobTitle || 'Documents'}{d.company ? ` · ${d.company}` : ''}</span>
                <button onClick={() => loadDoc(d)} aria-label={`Open documents for ${d.jobTitle || 'saved job'}`} className="text-sm font-semibold text-primary-700 j4u-focus rounded">Open</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
