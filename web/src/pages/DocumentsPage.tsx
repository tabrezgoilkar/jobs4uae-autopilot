import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import DownloadButtons from '../features/pdf/DownloadButtons';
import { Card, PageHeader, Button } from '../components/ui';

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';

export default function DocumentsPage() {
  const [params] = useSearchParams();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [evalId, setEvalId] = useState<string>(params.get('eval') ?? '');
  const [jobText, setJobText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [resume, setResume] = useState('');
  const [cover, setCover] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [fitScore, setFitScore] = useState('');
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    listEvaluations().then(setEvals).catch(() => {});
    listDocuments().then(setRecent).catch(() => {});
  }, []);

  const hasContent = resume.trim() || cover.trim();

  async function onGenerate() {
    setBusy(true);
    setMessage(null);
    try {
      const body = evalId ? { evaluationId: evalId } : { jobText, jobTitle, company };
      const draft = await generateDocuments(body);
      setResume(draft.resumeMarkdown);
      setCover(draft.coverLetterMarkdown);
      setJobTitle(draft.jobTitle);
      setCompany(draft.company);
      setFitScore(draft.fitScore);
      setMissingSkills(draft.missingSkills ?? []);
      setDocId(null);
      setMessage({ ok: true, text: 'Documents generated! Edit below, then Save.' });
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
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover, fitScore, missingSkills };
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
    // List refresh is non-critical; a failure here must not look like a save failure.
    listDocuments().then(setRecent).catch(() => {});
  }

  function loadDoc(d: DocumentRecord) {
    setDocId(d.id);
    setJobTitle(d.jobTitle);
    setCompany(d.company);
    setEvalId(d.evaluationId ?? '');
    setResume(d.resumeMarkdown);
    setCover(d.coverLetterMarkdown);
    setFitScore(d.fitScore ?? '');
    setMissingSkills(d.missingSkills ?? []);
    setMessage(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Generate a tailored resume and cover letter, edit them, and save." />

      <Card>
        <div className="space-y-3">
          {evals.length > 0 && (
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Use an evaluated job</span>
              <select className={FIELD} value={evalId} onChange={(e) => setEvalId(e.target.value)}>
                <option value="">— Paste a job instead —</option>
                {evals.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {(ev.jobTitle || 'Job')}{ev.company ? ` · ${ev.company}` : ''} ({ev.grade})
                  </option>
                ))}
              </select>
            </label>
          )}

          {evals.length === 0 && evalId && (
            <p className="text-sm text-warning-text bg-warning-soft border border-warning-soft rounded-lg p-2">
              Using a pre-selected job evaluation.
              <button className="ml-2 underline" onClick={() => setEvalId('')}>Clear and paste a job instead</button>
            </p>
          )}

          {!evalId && (
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Or paste a job description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-3 text-sm j4u-focus placeholder:text-ink-muted"
                rows={5}
                value={jobText}
                disabled={busy}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste the job posting here…"
              />
            </label>
          )}

          <Button onClick={onGenerate} disabled={busy || (!evalId && !jobText.trim())}>
            {busy ? 'Writing…' : 'Generate'}
          </Button>
        </div>
      </Card>

      {message && (
        <div role="status" className={`text-sm rounded-lg p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
          {message.text}
        </div>
      )}

      {hasContent && fitScore && (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-ink-strong">Fit for this job</h2>
            <span className="text-warning text-lg" aria-label={`${gradeToStars(fitScore)} out of 5`}>
              {'★'.repeat(gradeToStars(fitScore))}
              {'☆'.repeat(5 - gradeToStars(fitScore))}
            </span>
            <span className="text-sm text-ink-muted">({fitScore})</span>
          </div>
          {missingSkills.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-ink-secondary">Skills to add — and where to learn them free:</p>
              <ul className="mt-2 space-y-2">
                {missingSkills.map((s) => (
                  <li key={s} className="text-sm">
                    <span className="font-medium text-ink-strong">{s}</span>
                    <span className="ml-2 inline-flex flex-wrap gap-2 align-middle">
                      {learningLinks(s).map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 rounded-pill px-2.5 py-0.5 j4u-press"
                        >
                          {l.label} ↗
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-success-text">No major skill gaps — strong match! 🎯</p>
          )}
        </Card>
      )}

      {hasContent && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <label htmlFor="doc-resume" className="font-semibold text-ink-strong">Resume (Markdown)</label>
            <textarea
              id="doc-resume"
              aria-label="Resume content in Markdown"
              className="mt-2 w-full rounded-lg border border-hair bg-surface text-ink p-3 text-sm font-mono j4u-focus disabled:opacity-60"
              rows={20}
              value={resume}
              disabled={saving}
              onChange={(e) => setResume(e.target.value)}
            />
          </Card>
          <Card>
            <label htmlFor="doc-cover" className="font-semibold text-ink-strong">Cover letter (Markdown)</label>
            <textarea
              id="doc-cover"
              aria-label="Cover letter content in Markdown"
              className="mt-2 w-full rounded-lg border border-hair bg-surface text-ink p-3 text-sm font-mono j4u-focus disabled:opacity-60"
              rows={20}
              value={cover}
              disabled={saving}
              onChange={(e) => setCover(e.target.value)}
            />
          </Card>
        </div>
      )}

      {hasContent && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : docId ? 'Update saved documents' : 'Save documents'}
          </Button>
          <DownloadButtons docId={docId} />
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
