import { useEffect, useState } from 'react';
import { getUpskillHeatmap, type UpskillHeatmap } from '../api';
import { Card, PageHeader, Badge } from '../components/ui';

const HEAT: Record<string, { label: string; tone: 'danger' | 'warning' | 'success'; bar: string }> = {
  high: { label: 'High priority', tone: 'danger', bar: 'var(--danger)' },
  med: { label: 'Medium', tone: 'warning', bar: 'var(--warning)' },
  low: { label: 'Low', tone: 'success', bar: 'var(--success)' },
};

export default function UpskillPage() {
  const [data, setData] = useState<UpskillHeatmap | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUpskillHeatmap()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the upskill plan.'))
      .finally(() => setBusy(false));
  }, []);

  const cells = data?.cells ?? [];
  const maxGap = cells.reduce((m, c) => Math.max(m, c.gapScore), 0) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upskill plan"
        subtitle="Skills that keep costing you interviews across the jobs you've tracked — ranked by demand × fit-cost."
      />

      {busy && <Card><p className="text-sm text-ink-muted">Building your gap heatmap…</p></Card>}

      {error && (
        <div role="alert" className="rounded-md p-3 bg-danger-soft text-danger-text border border-danger-soft text-sm">{error}</div>
      )}

      {!busy && !error && cells.length === 0 && (
        <Card>
          <p className="text-sm text-ink-secondary">No gaps yet. Track a few applications (or run evaluations) and this view will surface the skills worth learning next.</p>
        </Card>
      )}

      {!busy && !error && cells.length > 0 && (
        <Card title={`${data?.totalJobs} tracked job${data?.totalJobs === 1 ? '' : 's'}`}>
          <ul className="divide-y divide-hair-subtle -my-1">
            {cells.map((c) => {
              const h = HEAT[c.heat] ?? HEAT.low;
              const pct = Math.round((c.gapScore / maxGap) * 100);
              return (
                <li key={c.skill} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink-strong capitalize">{c.skill}</span>
                    <Badge tone={h.tone}>{h.label}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="flex-1 h-1.5 rounded-pill bg-surface-sunken overflow-hidden">
                      <span className="block h-full rounded-pill" style={{ width: `${pct}%`, background: h.bar, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
                    </span>
                    <span className="text-[11px] text-ink-muted whitespace-nowrap">demand {c.demand} · cost {Math.round(c.avgCost * 100)}%</span>
                  </div>
                  {c.examples.length > 0 && (
                    <p className="mt-1 text-[11px] text-ink-muted truncate">Seen in: {c.examples.join(', ')}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
