import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { runEvaluation, listEvaluations, type Evaluation } from '../api';
import { Card, PageHeader, Button, Badge, GradeBadge, type Tone } from '../components/ui';

const REC: Record<string, { label: string; tone: Tone }> = {
  apply: { label: '✅ Apply', tone: 'success' },
  maybe: { label: '🤔 Maybe', tone: 'warning' },
  skip: { label: '🚫 Skip', tone: 'danger' },
};

function ResultCard({ ev }: { ev: Evaluation }) {
  const rec = REC[ev.recommendation] ?? { label: ev.recommendation, tone: 'neutral' as Tone };
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <GradeBadge grade={ev.grade} />
          <div>
            <h2 className="text-lg font-bold text-ink-strong">{ev.jobTitle || 'This job'}{ev.company ? ` · ${ev.company}` : ''}</h2>
            {ev.location && <p className="text-sm text-ink-muted">{ev.location}</p>}
            <div className="mt-1"><Badge tone={rec.tone}>{rec.label}</Badge></div>
          </div>
        </div>

        <p className="text-ink">{ev.summary}</p>

        {ev.dimensions.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {ev.dimensions.map((d, i) => (
              <div key={i} className="border border-hair-subtle rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-secondary">{d.name}</span>
                  <GradeBadge grade={d.score} size="sm" />
                </div>
                {d.comment && <p className="mt-1 text-xs text-ink-muted">{d.comment}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Matched skills</p>
            <p className="text-sm text-ink-secondary">{ev.matchedSkills.length ? ev.matchedSkills.join(', ') : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Skills to add</p>
            <p className="text-sm text-ink-secondary">{ev.missingSkills.length ? ev.missingSkills.join(', ') : '—'}</p>
          </div>
        </div>
        <Link
          to={`/documents?eval=${ev.id}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary-600 text-white text-sm font-semibold j4u-press"
        >
          Tailor resume &amp; cover letter →
        </Link>
      </div>
    </Card>
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
      <PageHeader title="Evaluate a job" subtitle="Paste a job description and get an honest A–F fit score based on your profile." />

      <Card>
        <label className="block">
          <span className="text-sm font-medium text-ink-secondary">Job description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-3 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60"
            rows={8}
            value={jobText}
            disabled={busy}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job posting here…"
          />
        </label>
        <Button onClick={onEvaluate} disabled={busy || !jobText.trim()} className="mt-3">
          {busy ? 'Evaluating…' : 'Evaluate'}
        </Button>
        {error && <div role="alert" className="mt-3 text-sm rounded-lg p-3 bg-danger-soft text-danger-text border border-danger-soft">{error}</div>}
      </Card>

      {result && <ResultCard ev={result} />}

      {!result && recent.length > 0 && (
        <Card title="Recent evaluations">
          <ul className="divide-y divide-hair-subtle -my-1">
            {recent.map((ev) => (
              <li key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-secondary truncate">{ev.jobTitle || 'Job'}{ev.company ? ` · ${ev.company}` : ''}</span>
                <GradeBadge grade={ev.grade} size="sm" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
