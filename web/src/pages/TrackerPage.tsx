import { useEffect, useState } from 'react';
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  type Application,
  type ApplicationStatus,
} from '../features/tracker/trackerApi';

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: 'bg-slate-100 text-slate-700',
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-yellow-100 text-yellow-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

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

  useEffect(() => {
    load();
  }, []);

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
    try {
      const updated = await updateApplication(app.id, { status: newStatus });
      setApps((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    } catch {
      // Leave card as-is; the select will snap back on next render
    } finally {
      setBusyIds((b) => ({ ...b, [app.id]: false }));
    }
  }

  async function handleDelete(id: string) {
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      await deleteApplication(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  }

  const grouped = STATUSES.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s) }),
    {} as Record<ApplicationStatus, Application[]>,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Application Tracker</h1>
        <p className="mt-1 text-slate-600">Track your job applications and their progress.</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow p-6 space-y-3">
        <h2 className="font-semibold text-slate-800">Add application</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Job title <span aria-hidden="true">*</span></span>
            <input
              aria-label="Job title"
              required
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              disabled={adding}
              placeholder="e.g. Software Engineer"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Company</span>
            <input
              aria-label="Company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={adding}
              placeholder="e.g. ACME Corp"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Location</span>
            <input
              aria-label="Location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={adding}
              placeholder="e.g. Dubai, UAE"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <input
              aria-label="Notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={adding}
              placeholder="e.g. Referral from John"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>
        </div>
        {addError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{addError}</p>
        )}
        <button
          type="submit"
          disabled={adding || !jobTitle.trim()}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add application'}
        </button>
      </form>

      {/* Load error fallback */}
      {loadError && (
        <div className="bg-red-50 rounded-2xl p-6 text-red-700 space-y-2">
          <p className="font-medium">Could not load applications</p>
          <p className="text-sm">{loadError}</p>
          <button onClick={load} className="text-sm underline">Try again</button>
        </div>
      )}

      {loading && !loadError && (
        <p className="text-slate-400 text-sm">Loading applications…</p>
      )}

      {/* Status board */}
      {!loading && !loadError && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((status) => {
            const column = grouped[status];
            return (
              <section key={status} aria-label={`${STATUS_LABELS[status]} applications`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-slate-400">{column.length}</span>
                </div>
                {column.length === 0 && (
                  <p className="text-xs text-slate-300 italic">None</p>
                )}
                {column.map((app) => {
                  const busy = !!busyIds[app.id];
                  return (
                    <article
                      key={app.id}
                      aria-label={`${app.jobTitle}${app.company ? ` at ${app.company}` : ''}`}
                      className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 space-y-2"
                    >
                      <div>
                        <p className="font-medium text-sm text-slate-800 leading-tight">{app.jobTitle || 'Untitled'}</p>
                        {app.company && <p className="text-xs text-slate-500">{app.company}</p>}
                        {app.location && <p className="text-xs text-slate-400">{app.location}</p>}
                      </div>
                      {app.notes && (
                        <p className="text-xs text-slate-500 line-clamp-2">{app.notes}</p>
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
                          className="w-full rounded-md border border-slate-200 text-xs p-1 disabled:opacity-50"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(app.id)}
                          disabled={busy}
                          aria-label={`Delete application for ${app.jobTitle || 'this job'}${app.company ? ` at ${app.company}` : ''}`}
                          className="w-full text-xs text-red-500 hover:text-red-700 disabled:opacity-40 py-0.5"
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
