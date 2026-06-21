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
      setDocId(null); // fresh draft, not yet saved
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
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover };
      const saved = docId ? await updateDocument(docId, payload) : await saveDocument(payload);
      setDocId(saved.id);
      setRecent(await listDocuments());
      setMessage({ ok: true, text: 'Saved.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function loadDoc(d: DocumentRecord) {
    setDocId(d.id);
    setJobTitle(d.jobTitle);
    setCompany(d.company);
    setEvalId(d.evaluationId ?? '');
    setResume(d.resumeMarkdown);
    setCover(d.coverLetterMarkdown);
    setMessage(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Resume & Cover Letter</h1>
        <p className="mt-1 text-slate-600">Generate a tailored resume and cover letter, edit them, and save.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        {evals.length > 0 && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Use an evaluated job</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
              value={evalId}
              onChange={(e) => setEvalId(e.target.value)}
            >
              <option value="">— Paste a job instead —</option>
              {evals.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {(ev.jobTitle || 'Job')}{ev.company ? ` · ${ev.company}` : ''} ({ev.grade})
                </option>
              ))}
            </select>
          </label>
        )}

        {!evalId && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Or paste a job description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={5}
              value={jobText}
              disabled={busy}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the job posting here…"
            />
          </label>
        )}

        <button
          onClick={onGenerate}
          disabled={busy || (!evalId && !jobText.trim())}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Writing…' : 'Generate'}
        </button>
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {hasContent && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-slate-800">Resume (Markdown)</h2>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-mono"
              rows={20}
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-slate-800">Cover letter (Markdown)</h2>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-mono"
              rows={20}
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
          </div>
        </div>
      )}

      {hasContent && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
            {saving ? 'Saving…' : docId ? 'Update saved documents' : 'Save documents'}
          </button>
          <span className="text-xs text-slate-400">Download as PDF arrives in the next phase.</span>
        </div>
      )}

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-slate-800">Saved documents</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700">{d.jobTitle || 'Documents'}{d.company ? ` · ${d.company}` : ''}</span>
                <button onClick={() => loadDoc(d)} className="text-sm text-blue-600">Open</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
