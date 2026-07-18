import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getConfig,
  getApplicationDetails,
  saveApplicationDetails,
  composeEmail,
  draftApplication,
  getReviewQueue,
  resolveReviewItem,
  clearReviewQueue,
  type ApplicationFields,
  type EmailDraft,
  type ApplyDraft,
  type ReviewQueueItem,
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
  const [form, setForm] = useState<ApplicationFields>(EMPTY_FIELDS);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

  // confidence-gated "Needs review" queue (low-confidence answers not submitted)
  const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>([]);
  const [editingReview, setEditingReview] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);

  // email-apply workspace
  const [emailJobText, setEmailJobText] = useState('');
  const [emailRecruiter, setEmailRecruiter] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getApplicationDetails().catch(() => null), getConfig().catch(() => null)]).then(([d, cfg]) => {
      const fields = { ...EMPTY_FIELDS, ...(d?.fields ?? {}) };
      // Seed blanks from the Settings application details, if any, so nothing is re-typed.
      const legacy = (cfg?.applicationDetails ?? {}) as Record<string, string>;
      for (const k of ['nationality', 'visaStatus', 'noticePeriod', 'expectedSalary'] as const) {
        if (!fields[k] && legacy[k]) fields[k] = legacy[k] as string;
      }
      setForm(fields);
    });
    getReviewQueue().then((q) => setReviewItems(q.items)).catch(() => {});
  }, []);

  async function onResolveReview(id: string) {
    const edited = editingReview[id] ?? '';
    if (!edited.trim()) return;
    setResolving(true);
    try {
      const q = await resolveReviewItem(id, edited.trim());
      setReviewItems(q.items);
      setEditingReview((e) => { const n = { ...e }; delete n[id]; return n; });
    } finally {
      setResolving(false);
    }
  }
  async function onClearReview() {
    setResolving(true);
    try { setReviewItems((await clearReviewQueue()).items); } finally { setResolving(false); }
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

  async function onDraftEmail() {
    if (!emailJobText.trim()) return;
    setDrafting(true); setEmailError(null); setDraft(null);
    try {
      const d = await composeEmail({ jobText: emailJobText.trim(), recruiterEmail: emailRecruiter.trim() || undefined });
      setDraft(d);
      setEmailRecruiter(d.to);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Could not draft the email.');
    } finally {
      setDrafting(false);
    }
  }
  // Rebuild draft links client-side so the user's edits to To/Subject/Body are reflected.
  const enc = encodeURIComponent;
  const mailtoOf = (d: EmailDraft) => `mailto:${d.to}?subject=${enc(d.subject)}&body=${enc(d.body)}`;
  const gmailOf = (d: EmailDraft) => `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(d.to)}&su=${enc(d.subject)}&body=${enc(d.body)}`;
  const patchDraft = (patch: Partial<EmailDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  // tailor-cv workspace (drafter -> reviewer -> honest ATS)
  const [tailorText, setTailorText] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState<ApplyDraft | null>(null);
  const [tailorError, setTailorError] = useState<string | null>(null);

  async function onTailor() {
    if (!tailorText.trim()) return;
    setTailoring(true); setTailorError(null); setTailorResult(null);
    try {
      setTailorResult(await draftApplication(tailorText.trim()));
    } catch (e) {
      setTailorError(e instanceof Error ? e.message : 'Could not draft the application.');
    } finally {
      setTailoring(false);
    }
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

      {/* Connections — desktop companion only. On the cloud/website build there is
          no headed browser, so board auto-fill cannot run here. The Email-apply
          and Tailor-CV sections below are the cloud-safe path. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Board auto-fill <span className="text-[11.5px] font-normal text-ink-muted">(desktop companion)</span></h2>
          <span className="text-[11.5px] text-ink-muted">runs in the desktop app</span>
        </div>
        <p className="text-[12px] text-ink-muted leading-snug">One-click board autofill opens a real browser and needs the desktop companion. On this website, use <b className="text-ink-secondary">Email apply</b> or <b className="text-ink-secondary">Tailor a CV</b> below — both work here.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BOARDS.map((b) => (
            <div key={b.id} className={`flex flex-col gap-3 rounded-md border p-4 transition-colors ${b.available ? 'border-hair-subtle bg-surface shadow-sm' : 'border-hair-subtle bg-surface-sunken'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`grid place-items-center w-9 h-9 flex-none rounded-md ${b.available ? 'bg-primary-50 text-primary-600' : 'bg-surface text-ink-muted'}`}><BriefcaseIcon /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink-strong truncate">{b.name}</div>
                  <div className="text-[11.5px] text-ink-muted truncate">{b.blurb}</div>
                </div>
                <Badge tone="neutral">desktop</Badge>
              </div>

              {!b.available && (
                <button type="button" disabled aria-disabled className="inline-flex items-center justify-center h-9 rounded-md border border-hair-subtle text-ink-muted text-[12.5px] font-semibold cursor-not-allowed">Coming soon</button>
              )}
              {b.available && (
                <button type="button" disabled aria-disabled className="inline-flex items-center justify-center h-9 rounded-md border border-hair-subtle text-ink-muted text-[12.5px] font-semibold cursor-not-allowed">Desktop only</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Confidence-gated "Needs review" queue — low-confidence answers were NOT submitted */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Needs review</h2>
          <span className="text-[11.5px] text-ink-muted">low-confidence answers — never auto-submitted</span>
        </div>
        <div className="rounded-md border border-warning-soft bg-surface p-4 shadow-sm space-y-3">
          {reviewItems.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">Nothing here. Low-confidence answers from apply passes land here for you to confirm or edit before they go on a form.</p>
          ) : (
            <>
              {reviewItems.map((it) => (
                <div key={it.id} className="rounded-md border border-hair-subtle bg-surface-sunken p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-ink-strong">{it.label}</span>
                    <Badge tone="warning">low confidence</Badge>
                  </div>
                  <p className="text-[11.5px] text-ink-muted">Missing grounding: <code className="text-ink-secondary">{it.missingReference}</code></p>
                  <label className="block">
                    <span className={LABEL}>Review / edit the answer, then confirm</span>
                    <textarea className={FIELD} rows={2} value={editingReview[it.id] ?? it.answer} onChange={(e) => setEditingReview((s) => ({ ...s, [it.id]: e.target.value }))} />
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => onResolveReview(it.id)} disabled={resolving} className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-primary-600 text-white text-[12px] font-semibold j4u-press disabled:opacity-60">
                      {resolving ? 'Saving…' : 'Confirm & remove'}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={onClearReview} disabled={resolving} className="j4u-chip inline-flex items-center justify-center h-9 rounded-md border border-hair text-ink-secondary text-[12.5px] font-semibold">Clear all</button>
            </>
          )}
        </div>
      </section>

      {/* Email-Apply — for "send your CV to hr@…" post-jobs (no board connection needed) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Email apply</h2>
          <span className="text-[11.5px] text-ink-muted">for "send your CV to hr@…" posts</span>
        </div>
        <div className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm space-y-3">
          <label className="block">
            <span className={LABEL}>Paste the job post or recruiter message</span>
            <textarea className={FIELD} rows={4} placeholder="e.g. We're hiring an Accountant in Dubai — send your CV to hr@company.com" value={emailJobText} onChange={(e) => setEmailJobText(e.target.value)} />
          </label>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="block flex-1 min-w-[220px]">
              <span className={LABEL}>Recruiter email {draft || emailRecruiter ? '' : '(auto-detected from the post)'}</span>
              <input className={FIELD} placeholder="hr@company.com" value={emailRecruiter} onChange={(e) => setEmailRecruiter(e.target.value)} />
            </label>
            <button onClick={onDraftEmail} disabled={drafting || !emailJobText.trim()} className="inline-flex items-center justify-center h-[38px] px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press disabled:opacity-60">
              {drafting ? 'Drafting…' : 'Draft email'}
            </button>
          </div>

          {emailError && <p role="alert" className="text-sm rounded-md p-2.5 bg-danger-soft text-danger-text border border-danger-soft">{emailError}</p>}

          {draft && (
            <div className="space-y-3 pt-1 border-t border-hair-subtle">
              <label className="block"><span className={LABEL}>To</span><input className={FIELD} value={draft.to} onChange={(e) => patchDraft({ to: e.target.value })} /></label>
              <label className="block"><span className={LABEL}>Subject</span><input className={FIELD} value={draft.subject} onChange={(e) => patchDraft({ subject: e.target.value })} /></label>
              <label className="block"><span className={LABEL}>Body — review &amp; edit before sending</span><textarea className={FIELD} rows={8} value={draft.body} onChange={(e) => patchDraft({ body: e.target.value })} /></label>
              <div className="flex gap-2 flex-wrap items-center">
                <a href={gmailOf(draft)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press">Open in Gmail</a>
                <a href={mailtoOf(draft)} className="j4u-chip inline-flex items-center justify-center h-9 px-4 rounded-md border border-hair text-ink-secondary text-[12.5px] font-semibold">Open mail app</a>
                <Link to="/evaluate" className="text-[12px] font-semibold text-primary-700 hover:underline j4u-focus rounded ml-auto">Attach your CV — download it from Documents →</Link>
              </div>
              <p className="text-[11.5px] text-ink-muted">Review before sending — the draft opens in your email, you attach the CV PDF and click Send. Nothing is sent automatically.</p>
            </div>
          )}
        </div>
      </section>

      {/* Tailor a CV for a job — drafter -> reviewer -> honest ATS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-strong">Tailor a CV for a job</h2>
          <span className="text-[11.5px] text-ink-muted">draft · honesty review · ATS check</span>
        </div>
        <div className="rounded-md border border-hair-subtle bg-surface p-4 shadow-sm space-y-3">
          <label className="block">
            <span className={LABEL}>Paste the job description</span>
            <textarea className={FIELD} rows={4} placeholder="Paste the full job posting…" value={tailorText} onChange={(e) => setTailorText(e.target.value)} />
          </label>
          <button onClick={onTailor} disabled={tailoring || !tailorText.trim()} className="inline-flex items-center justify-center gap-2 h-[38px] px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press disabled:opacity-60">
            {tailoring ? 'Drafting & reviewing…' : 'Tailor my CV'}
          </button>

          {tailorError && <p role="alert" className="text-sm rounded-md p-2.5 bg-danger-soft text-danger-text border border-danger-soft">{tailorError}</p>}

          {tailorResult && (
            <div className="space-y-4 pt-1 border-t border-hair-subtle">
              {/* Reviewer verdict */}
              <div className={`rounded-md border p-3 ${tailorResult.review.approved ? 'border-success-soft bg-success-soft text-success-text' : 'border-warning-soft bg-warning-soft text-warning-text'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold">Honesty review: {tailorResult.review.approved ? 'Approved' : 'Needs review'}</span>
                  <span className="text-[12px] tabular-nums">score {tailorResult.review.honestyScore}/100</span>
                </div>
                {tailorResult.review.issues.length > 0 && (
                  <ul className="mt-1.5 list-disc pl-4 text-[12px] space-y-0.5">
                    {tailorResult.review.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
              </div>

              {/* Honest ATS check */}
              <div className="rounded-md border border-hair-subtle p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink-strong">ATS parse check</span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${tailorResult.ats.atsReadable ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text'}`}>
                    {tailorResult.ats.atsReadable ? 'Parser-safe' : 'Parser may drop parts'}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[12px]">
                  <div>
                    <p className="text-ink-muted font-medium">Keywords present ({tailorResult.ats.presentKeywords.length})</p>
                    <p className="text-ink-secondary">{tailorResult.ats.presentKeywords.length ? tailorResult.ats.presentKeywords.join(', ') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted font-medium">Missing from CV ({tailorResult.ats.missingKeywords.length})</p>
                    <p className="text-ink-secondary">{tailorResult.ats.missingKeywords.length ? tailorResult.ats.missingKeywords.join(', ') : '—'}</p>
                  </div>
                </div>
                {tailorResult.ats.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-[11.5px] text-ink-muted space-y-0.5">
                    {tailorResult.ats.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>

              {/* Drafted documents */}
              <div className="space-y-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-ink-strong">Tailored resume (Markdown)</p>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-hair-subtle bg-surface-sunken p-3 text-[11.5px] text-ink-secondary">{tailorResult.draft.resumeMarkdown}</pre>
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-ink-strong">Cover letter</p>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-hair-subtle bg-surface-sunken p-3 text-[11.5px] text-ink-secondary">{tailorResult.draft.coverLetterMarkdown}</pre>
                </div>
                {tailorResult.draft.rationale && (
                  <p className="text-[11.5px] text-ink-muted"><b className="text-ink-secondary">Why:</b> {tailorResult.draft.rationale}</p>
                )}
              </div>
              <p className="text-[11.5px] text-ink-muted">Review and copy into your Documents, then submit via the job board yourself. Nothing is sent automatically.</p>
            </div>
          )}
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
