import { useEffect, useState } from 'react';
import {
  getConfig,
  getConnections,
  connectBoard,
  confirmBoard,
  disconnectBoard,
  getApplicationDetails,
  saveApplicationDetails,
  applyStart,
  applyAnswer,
  type Connection,
  type ApplicationFields,
  type PendingQuestion,
} from '../api';
import { PageHeader, Badge } from '../components/ui';
import { IconSparkle } from '../components/icons';

interface BoardDef { id: string; name: string; available: boolean; blurb: string; }

const BOARDS: BoardDef[] = [
  { id: 'indeed', name: 'Indeed', available: true, blurb: 'GCC roles across the Gulf' },
  { id: 'bayt', name: 'Bayt', available: false, blurb: 'Middle East job board' },
  { id: 'naukrigulf', name: 'Naukrigulf', available: false, blurb: 'Gulf-focused listings' },
  { id: 'gulftalent', name: 'GulfTalent', available: false, blurb: 'Professional GCC roles' },
  { id: 'linkedin', name: 'LinkedIn', available: false, blurb: 'Assisted & manual — never automated' },
];

const STEPS = [
  { n: 1, title: 'Connect once', body: 'Log in to a board yourself in a browser window the app opens. No passwords are ever stored — only the session.' },
  { n: 2, title: 'Pick a job', body: 'Paste a job URL (or pick a scanned one). Link a tailored CV and cover letter for the best fit.' },
  { n: 3, title: 'Copilot autofills', body: 'Contact details, your CV PDF, cover letter, and answers it already knows are filled in. New questions are asked once.' },
  { n: 4, title: 'You click Submit', body: 'You review the real application form and submit it yourself. The app never submits on your behalf.' },
];

const FIELD = 'mt-1 w-full rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-[12.5px] font-medium text-ink-secondary';

const EMPTY_FIELDS: ApplicationFields = {
  nationality: '', visaStatus: '', noticePeriod: '', currentSalary: '',
  expectedSalary: '', willingToRelocate: '', drivingLicence: '', languages: [],
};

function BriefcaseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default function AutoApplyPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'awaiting-login'>('idle');
  const [form, setForm] = useState<ApplicationFields>(EMPTY_FIELDS);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

  // apply workspace
  const [jobUrl, setJobUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [filledCount, setFilledCount] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [applyError, setApplyError] = useState<string | null>(null);
  const [savingAnswers, setSavingAnswers] = useState(false);

  const indeed = connections.find((c) => c.id === 'indeed');
  const connected = !!indeed?.connected;

  useEffect(() => {
    getConnections().then(setConnections).catch(() => {});
    Promise.all([getApplicationDetails().catch(() => null), getConfig().catch(() => null)]).then(([d, cfg]) => {
      const fields = { ...EMPTY_FIELDS, ...(d?.fields ?? {}) };
      // Seed blanks from the Settings application details, if any, so nothing is re-typed.
      const legacy = (cfg?.applicationDetails ?? {}) as Record<string, string>;
      for (const k of ['nationality', 'visaStatus', 'noticePeriod', 'expectedSalary'] as const) {
        if (!fields[k] && legacy[k]) fields[k] = legacy[k] as string;
      }
      setForm(fields);
    });
  }, []);

  async function onConnect() {
    setPhase('connecting');
    try {
      await connectBoard('indeed');
      setPhase('awaiting-login'); // a login window opened; user logs in there
    } catch {
      setPhase('idle');
    }
  }
  async function onConfirm() {
    try {
      setConnections(await confirmBoard('indeed'));
    } finally {
      setPhase('idle');
    }
  }
  async function onDisconnect() {
    setConnections(await disconnectBoard('indeed'));
    setFilledCount(null); setPending([]); setAnswers({});
  }

  async function onStart() {
    if (!jobUrl.trim()) return;
    setStarting(true); setApplyError(null); setFilledCount(null); setPending([]);
    try {
      const res = await applyStart({ board: 'indeed', jobUrl: jobUrl.trim() });
      setFilledCount(res.filledCount);
      setPending(res.pending);
      setAnswers(Object.fromEntries(res.pending.map((q) => [q.id, q.draft ?? ''])));
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Could not start the application.');
    } finally {
      setStarting(false);
    }
  }

  async function onSubmitAnswers() {
    const filled = pending.filter((q) => (answers[q.id] ?? '').trim()).map((q) => ({ id: q.id, answer: answers[q.id].trim() }));
    if (filled.length === 0) return;
    setSavingAnswers(true); setApplyError(null);
    try {
      const { remaining } = await applyAnswer({ board: 'indeed', answers: filled });
      setPending(remaining);
      setAnswers(Object.fromEntries(remaining.map((q) => [q.id, q.draft ?? ''])));
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Could not fill those answers.');
    } finally {
      setSavingAnswers(false);
    }
  }

  async function onSaveDetails() {
    setSavingDetails(true); setDetailsMsg(null);
    try {
      const saved = await saveApplicationDetails(form);
      setForm(saved.fields);
      setDetailsMsg('Saved.');
    } catch {
      setDetailsMsg('Could not save. Try again.');
    } finally {
      setSavingDetails(false);
    }
  }

  function setField<K extends keyof ApplicationFields>(k: K, v: ApplicationFields[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-6 j4u-rise">
      <PageHeader title="Auto-apply" subtitle="Assisted applications — the copilot prepares everything; you always click Submit." />

      {/* Safety posture */}
      <div className="j4u-grad-ai rounded-md p-4 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 flex-none rounded-md bg-surface"><IconSparkle size={17} color="var(--ai-600)" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-ink-strong">Assisted, never automated</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
            The app fills the form and stops at the employer's Submit button — <b className="text-ink">you</b> review and send.
            No passwords are stored, CAPTCHAs are yours to clear, and answers are never fabricated.
          </p>
        </div>
      </div>

      {/* Connections */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Connections</h2>
          <span className="text-[11.5px] text-ink-muted">Indeed is live · more rolling out</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BOARDS.map((b) => (
            <div key={b.id} className={`flex flex-col gap-3 rounded-md border p-4 transition-colors ${b.available ? 'border-hair-subtle bg-surface shadow-sm' : 'border-hair-subtle bg-surface-sunken'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`grid place-items-center w-9 h-9 flex-none rounded-md ${b.available ? 'bg-primary-50 text-primary-600' : 'bg-surface text-ink-muted'}`}><BriefcaseIcon /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink-strong truncate">{b.name}</div>
                  <div className="text-[11.5px] text-ink-muted truncate">{b.blurb}</div>
                </div>
                {b.available
                  ? <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'connected' : 'live'}</Badge>
                  : <Badge tone="neutral">coming soon</Badge>}
              </div>

              {!b.available && (
                <button type="button" disabled aria-disabled className="inline-flex items-center justify-center h-9 rounded-md border border-hair-subtle text-ink-muted text-[12.5px] font-semibold cursor-not-allowed">Coming soon</button>
              )}
              {b.available && connected && (
                <button type="button" onClick={onDisconnect} className="j4u-chip inline-flex items-center justify-center h-9 rounded-md border border-hair text-ink-secondary text-[12.5px] font-semibold">Disconnect</button>
              )}
              {b.available && !connected && phase !== 'awaiting-login' && (
                <button type="button" onClick={onConnect} disabled={phase === 'connecting'} className="inline-flex items-center justify-center gap-2 h-9 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press j4u-focus hover:bg-primary-700 transition-colors disabled:opacity-60">
                  {phase === 'connecting' ? <><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Opening…</> : 'Connect'}
                </button>
              )}
              {b.available && !connected && phase === 'awaiting-login' && (
                <div className="space-y-1.5">
                  <p className="text-[11.5px] text-ink-secondary leading-snug">Log in to Indeed in the window that opened, then:</p>
                  <button type="button" onClick={onConfirm} className="w-full inline-flex items-center justify-center h-9 rounded-md bg-success text-white text-[12.5px] font-semibold j4u-press">I've logged in</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Apply workspace — only once connected */}
      {connected && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-ink-strong">Apply to a job</h2>
          <div className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm space-y-3">
            <label className="block">
              <span className={LABEL}>Indeed job URL</span>
              <div className="mt-1 flex gap-2 flex-wrap">
                <input className={`${FIELD} flex-1 min-w-[220px] mt-0`} placeholder="https://ae.indeed.com/viewjob?jk=…" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
                <button onClick={onStart} disabled={starting || !jobUrl.trim()} className="inline-flex items-center justify-center gap-2 h-[38px] px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press disabled:opacity-60">
                  {starting ? 'Opening & filling…' : 'Open & autofill'}
                </button>
              </div>
            </label>

            {applyError && <p role="alert" className="text-sm rounded-md p-2.5 bg-danger-soft text-danger-text border border-danger-soft">{applyError}</p>}

            {filledCount !== null && (
              <div className="rounded-md border border-success-soft bg-success-soft text-success-text px-3 py-2 text-[12.5px]">
                Filled {filledCount} field{filledCount === 1 ? '' : 's'} in the open window{pending.length > 0 ? ` · ${pending.length} question${pending.length === 1 ? '' : 's'} need you below.` : '.'}
              </div>
            )}

            {pending.length > 0 && (
              <div className="space-y-3">
                <div className="text-[12.5px] font-semibold text-ink-strong">Answer these once — they'll be remembered:</div>
                {pending.map((q) => (
                  <label key={q.id} className="block">
                    <span className={LABEL}>{q.label}{q.draft ? <span className="ml-2 text-[10px] font-semibold text-ai-700 uppercase tracking-wide">AI draft — review</span> : null}</span>
                    {q.type === 'textarea' || q.draft ? (
                      <textarea className={FIELD} rows={3} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    ) : (
                      <input className={FIELD} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                  </label>
                ))}
                <button onClick={onSubmitAnswers} disabled={savingAnswers} className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press disabled:opacity-60">
                  {savingAnswers ? 'Filling…' : 'Fill these into the form'}
                </button>
              </div>
            )}

            {filledCount !== null && pending.length === 0 && (
              <div className="rounded-md j4u-grad-ai px-3 py-2.5 text-[12.5px] text-ink-strong font-medium flex items-center gap-2">
                <IconSparkle size={15} color="var(--ai-600)" /> Everything's filled. Review the form in the browser window and click <b>Submit</b> yourself.
              </div>
            )}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-ink-strong">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm">
              <span className="grid place-items-center w-7 h-7 rounded-md bg-ai-soft text-ai-700 text-[12px] font-bold tabular-nums">{s.n}</span>
              <div className="mt-2.5 text-[13px] font-semibold text-ink-strong">{s.title}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Application details — the answers autofill reuses */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-ink-strong">Your application details</h2>
        <p className="text-[12px] text-ink-muted -mt-1">Saved locally and reused to autofill every form. Never fabricated — left blank, the copilot asks you once.</p>
        <div className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={LABEL}>Nationality</span><input className={FIELD} value={form.nationality} onChange={(e) => setField('nationality', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Visa / Iqama status</span><input className={FIELD} value={form.visaStatus} onChange={(e) => setField('visaStatus', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Notice period</span><input className={FIELD} value={form.noticePeriod} onChange={(e) => setField('noticePeriod', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Willing to relocate</span><input className={FIELD} placeholder="e.g. Yes, within GCC" value={form.willingToRelocate} onChange={(e) => setField('willingToRelocate', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Current salary (monthly)</span><input className={FIELD} value={form.currentSalary} onChange={(e) => setField('currentSalary', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Expected salary (monthly)</span><input className={FIELD} value={form.expectedSalary} onChange={(e) => setField('expectedSalary', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Driving licence</span><input className={FIELD} placeholder="e.g. UAE light vehicle" value={form.drivingLicence} onChange={(e) => setField('drivingLicence', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Languages (comma separated)</span><input className={FIELD} value={form.languages.join(', ')} onChange={(e) => setField('languages', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button onClick={onSaveDetails} disabled={savingDetails} className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press disabled:opacity-60">{savingDetails ? 'Saving…' : 'Save details'}</button>
            {detailsMsg && <span className="text-[12px] text-ink-muted">{detailsMsg}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
