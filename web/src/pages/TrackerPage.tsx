import { useEffect, useMemo, useState } from 'react';
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  type Application,
  type ApplicationStatus,
} from '../features/tracker/trackerApi';
import { Card, PageHeader, Button } from '../components/ui';
import { Donut, useCountUp, type Segment } from '../components/charts';

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

/** Accent colour per status — drives the card edge and the pipeline donut/dots. */
const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: 'var(--text-muted)',
  applied: 'var(--primary-600)',
  interview: 'var(--ai-600)',
  offer: 'var(--success)',
  rejected: 'var(--danger)',
};

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60';

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Per-card busy tracking: appId -> true
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  // Top-level action error (status change / delete)
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listApplications();
      setApps(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load applications.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await createApplication({ jobTitle: jobTitle.trim(), company: company.trim(), location: location.trim(), notes: notes.trim() });
      setApps((prev) => [created, ...prev]);
      setJobTitle('');
      setCompany('');
      setLocation('');
      setNotes('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not add application.');
    } finally {
      setAdding(false);
    }
  }

  async function handleStatusChange(app: Application, newStatus: ApplicationStatus) {
    setBusyIds((b) => ({ ...b, [app.id]: true }));
    setActionError(null);
    try {
      const updated = await updateApplication(app.id, { status: newStatus });
      setApps((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    } catch (e) {
      // Leave card as-is; the select will snap back on next render
      setActionError(e instanceof Error ? e.message : 'Could not update status. Please try again.');
    } finally {
      setBusyIds((b) => ({ ...b, [app.id]: false }));
    }
  }

  async function handleDelete(id: string) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    setActionError(null);
    try {
      await deleteApplication(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete. Please try again.');
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(
    () =>
      STATUSES.reduce<Record<ApplicationStatus, Application[]>>(
        (acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s) }),
        {} as Record<ApplicationStatus, Application[]>,
      ),
    [apps],
  );

  const count = (s: ApplicationStatus) => grouped[s]?.length ?? 0;
  // Active pipeline excludes rejected (mirrors the Dashboard pipeline donut).
  const activeStatuses: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer'];
  const activeTotal = activeStatuses.reduce((n, s) => n + count(s), 0);
  const animTotal = useCountUp(activeTotal);
  const segments: Segment[] = activeStatuses.map((s) => ({
    value: count(s),
    color: STATUS_COLOR[s],
    label: STATUS_LABELS[s],
  }));

  return (
    <div className="space-y-6 j4u-rise">
      <PageHeader title="Tracker" subtitle="Track your job applications from saved to offer." />

      {/* Pipeline summary — animated donut + per-status stats (matches Dashboard) */}
      {!loading && !loadError && apps.length > 0 && (
        <div className="bg-surface border border-hair-subtle rounded-[14px] p-5">
          <div className="text-sm font-bold text-ink-strong mb-4">Your pipeline</div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Donut segments={segments}>
              <div className="text-[26px] font-bold text-ink-strong tabular-nums leading-none">{animTotal}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">active</div>
            </Donut>
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: STATUS_COLOR[s] }} />
                  <span className="flex-1 text-[13px] text-ink-secondary">{STATUS_LABELS[s]}</span>
                  <span className="text-[15px] font-bold text-ink-strong tabular-nums">{count(s)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      <Card title="Add application">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Job title <span aria-hidden="true">*</span></span>
              <input aria-label="Job title" required type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={adding} placeholder="e.g. Software Engineer" className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Company</span>
              <input aria-label="Company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} disabled={adding} placeholder="e.g. ACME Corp" className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Location</span>
              <input aria-label="Location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} disabled={adding} placeholder="e.g. Dubai, UAE" className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Notes</span>
              <input aria-label="Notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={adding} placeholder="e.g. Referral from John" className={FIELD} />
            </label>
          </div>
          {addError && (
            <p role="alert" className="text-sm text-danger-text bg-danger-soft border border-danger-soft rounded-lg p-2">{addError}</p>
          )}
          <Button type="submit" disabled={adding || !jobTitle.trim()}>
            {adding ? 'Adding…' : 'Add application'}
          </Button>
        </form>
      </Card>

      {actionError && (
        <p role="alert" className="text-sm rounded-lg p-3 bg-danger-soft text-danger-text border border-danger-soft">{actionError}</p>
      )}

      {/* Load error fallback */}
      {loadError && (
        <div className="bg-danger-soft border border-danger-soft rounded-xl p-6 text-danger-text space-y-2">
          <p className="font-medium">Could not load applications</p>
          <p className="text-sm">{loadError}</p>
          <button onClick={load} className="text-sm underline">Try again</button>
        </div>
      )}

      {loading && !loadError && (
        <p className="text-ink-muted text-sm">Loading applications…</p>
      )}

      {/* Empty state */}
      {!loading && !loadError && apps.length === 0 && (
        <div className="bg-surface border border-hair-subtle rounded-[14px] px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink-strong">No applications yet</p>
          <p className="mt-1 text-sm text-ink-muted">Add one above, or save a role from Scan — it'll show up on your board here.</p>
        </div>
      )}

      {/* Status board */}
      {!loading && !loadError && apps.length > 0 && (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((status) => {
            const column = grouped[status];
            return (
              <section key={status} aria-label={`${STATUS_LABELS[status]} applications`} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-none" style={{ background: STATUS_COLOR[status] }} />
                    <span className="text-[13px] font-bold text-ink-strong">{STATUS_LABELS[status]}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-ink-muted tabular-nums rounded-pill bg-surface-sunken px-2 py-0.5">
                    {column.length}
                  </span>
                </div>
                <div
                  className="flex flex-col gap-2.5 rounded-[12px] p-2 min-h-[64px]"
                  style={{ background: 'var(--surface-sunken)' }}
                >
                  {column.length === 0 && (
                    <p className="text-xs text-ink-muted italic px-1 py-3 text-center">Nothing here</p>
                  )}
                  {column.map((app) => {
                    const busy = !!busyIds[app.id];
                    return (
                      <article
                        key={app.id}
                        aria-label={`${app.jobTitle}${app.company ? ` at ${app.company}` : ''}`}
                        className="group bg-surface rounded-[10px] border border-hair-subtle p-3 space-y-2.5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
                        style={{ borderLeft: `3px solid ${STATUS_COLOR[status]}` }}
                      >
                        <div>
                          <p className="font-semibold text-[13.5px] text-ink-strong leading-tight">{app.jobTitle || 'Untitled'}</p>
                          {app.company && <p className="text-xs text-ink-secondary mt-0.5">{app.company}</p>}
                          {app.location && <p className="text-[11.5px] text-ink-muted">{app.location}</p>}
                        </div>
                        {app.notes && (
                          <p className="text-[11.5px] text-ink-muted line-clamp-2 leading-snug">{app.notes}</p>
                        )}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <label htmlFor={`status-${app.id}`} className="sr-only">
                            Status for {app.jobTitle || 'application'}
                          </label>
                          <select
                            id={`status-${app.id}`}
                            value={app.status}
                            disabled={busy}
                            onChange={(e) => handleStatusChange(app, e.target.value as ApplicationStatus)}
                            className="flex-1 rounded-lg border border-hair bg-surface text-ink text-xs px-2 py-1.5 disabled:opacity-50 j4u-focus cursor-pointer"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDelete(app.id)}
                            disabled={busy}
                            aria-label={`Delete application for ${app.jobTitle || 'this job'}${app.company ? ` at ${app.company}` : ''}`}
                            title="Delete"
                            className="flex-none grid place-items-center w-7 h-7 rounded-lg text-ink-muted hover:text-danger-text hover:bg-danger-soft disabled:opacity-40 transition-colors j4u-focus"
                          >
                            {busy ? (
                              <span className="text-[10px]">…</span>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M10 11v6M14 11v6" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
