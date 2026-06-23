import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConfig, type AppConfig } from '../api';
import { PageHeader, Badge } from '../components/ui';
import { IconSparkle } from '../components/icons';

interface BoardDef {
  id: string;
  name: string;
  available: boolean;
  blurb: string;
}

// Indeed is live (the one verified scanning board); the rest follow the same pattern.
const BOARDS: BoardDef[] = [
  { id: 'indeed', name: 'Indeed', available: true, blurb: 'GCC roles across the Gulf' },
  { id: 'bayt', name: 'Bayt', available: false, blurb: 'Middle East job board' },
  { id: 'naukrigulf', name: 'Naukrigulf', available: false, blurb: 'Gulf-focused listings' },
  { id: 'gulftalent', name: 'GulfTalent', available: false, blurb: 'Professional GCC roles' },
  { id: 'linkedin', name: 'LinkedIn', available: false, blurb: 'Assisted & manual — never automated' },
];

const STEPS = [
  { n: 1, title: 'Connect once', body: 'Log in to a board yourself in a browser window the app opens. No passwords are ever stored — only the session.' },
  { n: 2, title: 'Pick a job', body: 'Choose a scanned or pasted job. Link a tailored CV and cover letter for the best fit.' },
  { n: 3, title: 'Copilot autofills', body: 'Contact details, your CV PDF, cover letter, and answers it already knows are filled in. New questions are asked once.' },
  { n: 4, title: 'You click Submit', body: 'You review the real application form and submit it yourself. The app never submits on your behalf.' },
];

function BriefcaseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default function AutoApplyPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => { getConfig().then(setConfig).catch(() => {}); }, []);

  const details = config?.applicationDetails ?? {};
  const detailRows = [
    { label: 'Nationality', value: details.nationality },
    { label: 'Visa status', value: details.visaStatus },
    { label: 'Notice period', value: details.noticePeriod },
    { label: 'Expected salary', value: details.expectedSalary },
  ];
  const hasDetails = detailRows.some((d) => !!d.value?.trim());

  function connectIndeed() {
    // Assisted-connect (persistent browser session) is the next backend step; for now
    // this opens the board so the user can log in / apply manually — honest, not faked.
    setConnecting('indeed');
    window.open('https://ae.indeed.com/', '_blank', 'noopener');
    setTimeout(() => setConnecting(null), 1200);
  }

  return (
    <div className="space-y-6 j4u-rise">
      <PageHeader
        title="Auto-apply"
        subtitle="Assisted applications — the copilot prepares everything; you always click Submit."
      />

      {/* Safety posture */}
      <div className="j4u-grad-ai rounded-md p-4 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 flex-none rounded-md bg-surface">
          <IconSparkle size={17} color="var(--ai-600)" />
        </span>
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
            <div
              key={b.id}
              className={`flex flex-col gap-3 rounded-md border p-4 transition-colors ${b.available ? 'border-hair-subtle bg-surface shadow-sm' : 'border-hair-subtle bg-surface-sunken'}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`grid place-items-center w-9 h-9 flex-none rounded-md ${b.available ? 'bg-primary-50 text-primary-600' : 'bg-surface text-ink-muted'}`}>
                  <BriefcaseIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink-strong truncate">{b.name}</div>
                  <div className="text-[11.5px] text-ink-muted truncate">{b.blurb}</div>
                </div>
                {b.available ? <Badge tone="success">live</Badge> : <Badge tone="neutral">coming soon</Badge>}
              </div>
              {b.available ? (
                <button
                  type="button"
                  onClick={connectIndeed}
                  disabled={connecting === b.id}
                  className="inline-flex items-center justify-center gap-2 h-9 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press j4u-focus hover:bg-primary-700 transition-colors disabled:opacity-60"
                >
                  {connecting === b.id ? (
                    <><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Opening…</>
                  ) : 'Connect'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex items-center justify-center h-9 rounded-md border border-hair-subtle text-ink-muted text-[12.5px] font-semibold cursor-not-allowed"
                >
                  Coming soon
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

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

      {/* Application details (reused to autofill answers) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Your application details</h2>
          <Link to="/settings" className="text-[12px] font-semibold text-primary-700 hover:underline j4u-focus rounded-sm">Edit in Settings →</Link>
        </div>
        <div className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm">
          {hasDetails ? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {detailRows.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-3 min-w-0">
                  <dt className="text-[12.5px] text-ink-secondary">{d.label}</dt>
                  <dd className="text-[12.5px] font-semibold text-ink-strong truncate">{d.value?.trim() ? d.value : '—'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[12.5px] text-ink-muted">
              No saved answers yet. <Link to="/settings" className="text-primary-700 font-semibold hover:underline">Add your standard details</Link> (nationality, visa status, notice period, expected salary) so the copilot can autofill them.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
