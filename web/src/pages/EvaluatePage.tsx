import { useEffect, useState } from 'react';
import { runEvaluation, listEvaluations, type Evaluation } from '../api';

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-emerald-100 text-emerald-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-orange-100 text-orange-800',
  F: 'bg-red-100 text-red-800',
};
const REC_LABEL: Record<string, string> = { apply: '✅ Apply', maybe: '🤔 Maybe', skip: '🚫 Skip' };

function ResultCard({ ev }: { ev: Evaluation }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold ${GRADE_COLOR[ev.grade] ?? 'bg-slate-100 text-slate-700'}`}>
          {ev.grade}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{ev.jobTitle || 'This job'}{ev.company ? ` · ${ev.company}` : ''}</h2>
          {ev.location && <p className="text-sm text-slate-500">{ev.location}</p>}
          <p className="mt-1 text-sm font-medium">{REC_LABEL[ev.recommendation] ?? ev.recommendation}</p>
        </div>
      </div>

      <p className="text-slate-700">{ev.summary}</p>

      {ev.dimensions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {ev.dimensions.map((d, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{d.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${GRADE_COLOR[d.score] ?? 'bg-slate-100 text-slate-700'}`}>{d.score}</span>
              </div>
              {d.comment && <p className="mt-1 text-xs text-slate-500">{d.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Matched skills</p>
          <p className="text-sm text-slate-700">{ev.matchedSkills.length ? ev.matchedSkills.join(', ') : '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Skills to add</p>
          <p className="text-sm text-slate-700">{ev.missingSkills.length ? ev.missingSkills.join(', ') : '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function EvaluatePage() {
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [recent, setRecent] = useState<Evaluation[]>([]);

  useEffect(() => {
    listEvaluations().then(setRecent).catch(() => {});
  }, []);

  async function onEvaluate() {
    if (!jobText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await runEvaluation(jobText);
      setResult(ev);
      setRecent((r) => [ev, ...r]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Evaluate a Job</h1>
        <p className="mt-1 text-slate-600">Paste a job description and get an honest A–F fit score based on your profile.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Job description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
            rows={8}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job posting here…"
          />
        </label>
        <button
          onClick={onEvaluate}
          disabled={busy || !jobText.trim()}
          className="mt-3 px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Evaluating…' : 'Evaluate'}
        </button>
        {error && <div className="mt-3 text-sm rounded-lg p-3 bg-red-50 text-red-700">{error}</div>}
      </div>

      {result && <ResultCard ev={result} />}

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-slate-800">Recent evaluations</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700">{ev.jobTitle || 'Job'}{ev.company ? ` · ${ev.company}` : ''}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${GRADE_COLOR[ev.grade] ?? 'bg-slate-100 text-slate-700'}`}>{ev.grade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
