import { useEffect, useState } from 'react';
import { getUpskillHeatmap, type UpskillCell, type UpskillResult } from '../api';
import { Card, PageHeader, Button } from '../components/ui';

const HEAT: Record<UpskillCell['heat'], { label: string; bg: string; text: string }> = {
  high: { label: 'High priority', bg: 'bg-danger-soft', text: 'text-danger-text' },
  med: { label: 'Medium', bg: 'bg-warning-soft', text: 'text-warning-text' },
  low: { label: 'Low', bg: 'bg-hair-subtle', text: 'text-ink-muted' },
};

export default function UpskillPage() {
  const [data, setData] = useState<UpskillResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await getUpskillHeatmap());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the upskill heatmap.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upskill planner"
        subtitle="Skills to learn next, ranked by how often the jobs you tracked wanted them and how much each one cost you in fit."
      />

      {loading && <Card>Loading…</Card>}
      {error && (
        <div role="alert" className="text-sm rounded-md p-3 bg-danger-soft text-danger-text border border-danger-soft">{error}</div>
      )}

      {!loading && data && data.totalJobs === 0 && (
        <Card>
          <p className="text-ink">
            No tracked applications with evaluations yet. Evaluate a few jobs and save them to the
            tracker, and this heatmap will show which skills to learn first.
          </p>
        </Card>
      )}

      {!loading && data && data.totalJobs > 0 && (
        <>
          <Card title={`Top gaps across ${data.totalJobs} tracked job${data.totalJobs === 1 ? '' : 's'}`}>
            {data.cells.length === 0 ? (
              <p className="text-sm text-ink-muted">
                None of your tracked evaluations listed missing skills. Nice — you're a strong fit across the board.
              </p>
            ) : (
              <ul className="divide-y divide-hair-subtle -my-1">
                {data.cells.map((c) => {
                  const h = HEAT[c.heat];
                  return (
                    <li key={c.skill} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-secondary capitalize">{c.skill}</p>
                        <p className="text-xs text-ink-muted truncate">
                          wanted in {c.demand} job{c.demand === 1 ? '' : 's'} · avg fit cost {Math.round(c.avgCost * 100)}%
                          {c.examples.length ? ` · e.g. ${c.examples.join(', ')}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${h.bg} ${h.text}`}>{h.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={load}>Refresh</Button>
          </div>
        </>
      )}
    </div>
  );
}
