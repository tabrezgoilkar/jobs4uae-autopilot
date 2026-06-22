import { useEffect, useState } from 'react';
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  type Application,
  type ApplicationStatus,
} from '../features/tracker/trackerApi';
import { Card, PageHeader, Button, Badge, type Tone } from '../components/ui';

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  saved: 'neutral',
  applied: 'primary',
  interview: 'warning',
  offer: 'success',
  rejected: 'danger',
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

  const grouped = STATUSES.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s) }),
    {} as Record<ApplicationStatus, Application[]>,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Tracker" subtitle="Track your job applications and their progress." />

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

      {/* Status board */}
      {!loading && !loadError && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((status) => {
            const column = grouped[status];
            return (
              <section key={status} aria-label={`${STATUS_LABELS[status]} applications`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
                  <span className="text-xs text-ink-muted tabular-nums">{column.length}</span>
                </div>
                {column.length === 0 && (
                  <p className="text-xs text-ink-muted italic">None</p>
                )}
                {column.map((app) => {
                  const busy = !!busyIds[app.id];
                  return (
                    <article
                      key={app.id}
                      aria-label={`${app.jobTitle}${app.company ? ` at ${app.company}` : ''}`}
                      className="bg-surface rounded-xl shadow-sm border border-hair-subtle p-3 space-y-2"
                    >
                      <div>
                        <p className="font-medium text-sm text-ink-strong leading-tight">{app.jobTitle || 'Untitled'}</p>
                        {app.company && <p className="text-xs text-ink-secondary">{app.company}</p>}
                        {app.location && <p className="text-xs text-ink-muted">{app.location}</p>}
                      </div>
                      {app.notes && (
                        <p className="text-xs text-ink-muted line-clamp-2">{app.notes}</p>
                      )}
                      <div className="space-y-1">
                        <label htmlFor={`status-${app.id}`} className="sr-only">
                          Status for {app.jobTitle || 'application'}
                        </label>
                        <select
                          id={`status-${app.id}`}
                          value={app.status}
                          disabled={busy}
                          onChange={(e) => handleStatusChange(app, e.target.value as ApplicationStatus)}
                          className="w-full rounded-md border border-hair bg-surface text-ink text-xs p-1 disabled:opacity-50 j4u-focus"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(app.id)}
                          disabled={busy}
                          aria-label={`Delete application for ${app.jobTitle || 'this job'}${app.company ? ` at ${app.company}` : ''}`}
                          className="w-full text-xs text-danger-text hover:underline disabled:opacity-40 py-0.5"
                        >
                          {busy ? 'Working…' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
