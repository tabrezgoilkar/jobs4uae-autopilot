import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  scan,
  evaluateListing,
  evaluateJobText,
  fetchJobFromUrl,
  estimateSalary,
  optimizeResume,
  researchCompany,
  type Listing,
  type SalaryEstimate,
  type ResumeOptimization,
  type CompanyBrief,
} from '../features/scanner/scannerApi';
import { matchJob } from '../features/scanner/match';
import { getProfile, getFitScore, type Profile, type FitScore } from '../api';
import { loadScanState, saveScanState, defaultScanState, type RowState } from '../features/scanner/scanStore';
import { PageHeader, Button, Badge, GradeBadge, type Tone } from '../components/ui';
import { learningLinks } from '../lib/skills';
import { IconSparkle } from '../components/icons';

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];
const GRADE_PCT: Record<string, number> = { A: 92, B: 82, C: 68, D: 52, F: 35 };

// Friendly label + tone for the source tag on each scanned/pasted job.
const SOURCE_LABEL: Record<string, { label: string; tone: string }> = {
  linkedin: { label: 'LinkedIn', tone: 'bg-[#e8f0fb] text-[#0a66c2] border-[#cfe1f7]' },
  freehire: { label: 'FreeHire', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  indeed: { label: 'Indeed', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
};
function sourceTag(source?: string) {
  if (!source) return { label: 'Link', tone: 'bg-surface-sunken text-ink-muted border-hair-subtle' };
  const known = SOURCE_LABEL[source];
  if (known) return known;
  // Unknown sources (company careers pages, ATS links, etc.) — show the host as-is.
  return { label: source.length > 22 ? source.slice(0, 20) + '…' : source, tone: 'bg-surface-sunken text-ink-secondary border-hair-subtle' };
}
const FIELD = 'rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60';
const REC_TONE: Record<string, { label: string; tone: Tone }> = {
  apply: { label: 'Apply', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  skip: { label: 'Skip', tone: 'danger' },
};

interface SalaryState { busy: boolean; data: SalaryEstimate | null; error: string | null; }

export default function ScanPage() {
  const initial = useMemo(() => loadScanState(defaultScanState(GCC_COUNTRIES[0])), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);

  const [keyword, setKeyword] = useState(initial.keyword);
  const [country, setCountry] = useState(initial.country);
  const [city] = useState(initial.city);

  const [scanning, setScanning] = useState(false);
  const [listings, setListings] = useState<Listing[]>(initial.listings);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(initial.hasScanned);
  const [rows, setRows] = useState<Record<string, RowState>>(initial.rows);
  const [selected, setSelected] = useState<string | null>(initial.selected);

  // Paste-a-link flow.
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);

  // Multi-select + batch scoring.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ busy: boolean; done: number; total: number }>({ busy: false, done: 0, total: 0 });

  // Salary benchmark cache, keyed by listing url.
  const [salaries, setSalaries] = useState<Record<string, SalaryState>>({});

  // Deterministic weighted fit score (no AI) keyed by listing url — the
  // transparent "where does the number come from" breakdown.
  const [fitByUrl, setFitByUrl] = useState<Record<string, FitScore | null>>({});

  async function fetchFit(url: string, jobText: string) {
    if (!profile) return;
    try {
      const fit = await getFitScore(jobText);
      setFitByUrl((prev) => ({ ...prev, [url]: fit }));
    } catch {
      /* fit is best-effort; never block the page on it */
    }
  }

  useEffect(() => {
    saveScanState({ keyword, country, city, listings, rows, selected, hasScanned });
  }, [keyword, country, city, listings, rows, selected, hasScanned]);

  function setRow(url: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [url]: { ...(prev[url] ?? { busy: false, result: null, error: null }), ...patch } }));
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || scanning) return;
    setScanning(true); setScanError(null); setListings([]); setRows({}); setSelected(null); setHasScanned(false); setPicked(new Set());
    try {
      const result = await scan({ keyword: keyword.trim(), country, city: city.trim() || undefined });
      setListings(result.listings);
      if (result.listings[0]) setSelected(result.listings[0].url);
      if (result.error && result.listings.length === 0) setScanError(result.error);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false); setHasScanned(true);
    }
  }

  async function handlePasteLink(e: React.FormEvent) {
    e.preventDefault();
    const url = pasteUrl.trim();
    if (!url || pasteBusy) return;
    setPasteBusy(true);
    setScanError(null);
    try {
      const { jobText, source } = await fetchJobFromUrl(url);
      const result = await evaluateJobText(jobText);
      const r = result as Record<string, unknown>;
      const listing: Listing = {
        title: (typeof r.jobTitle === 'string' && r.jobTitle) || 'Pasted job',
        company: typeof r.company === 'string' ? r.company : '',
        location: typeof r.location === 'string' ? r.location : '',
        url,
        source: source || 'link',
      };
      setListings((prev) => [listing, ...prev.filter((l) => l.url !== url)]);
      setRows((prev) => ({ ...prev, [url]: { busy: false, result, error: null } }));
      setSelected(url);
      setHasScanned(true);
      setPasteUrl('');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not add that job link.');
    } finally {
      setPasteBusy(false);
    }
  }

  async function evalCore(listing: Listing) {
    const key = listing.url;
    setRow(key, { busy: true, error: null, result: null });
    const jobText = [
      listing.title && `Job Title: ${listing.title}`,
      listing.company && `Company: ${listing.company}`,
      listing.location && `Location: ${listing.location}`,
      listing.url && `URL: ${listing.url}`,
    ].filter(Boolean).join('\n');
    try {
      const result = await evaluateListing(listing);
      setRow(key, { busy: false, result, error: null });
      void fetchFit(key, jobText);
    } catch (e) {
      setRow(key, { busy: false, result: null, error: e instanceof Error ? e.message : 'Evaluation failed.' });
    }
  }

  async function evaluate(listing: Listing) {
    setSelected(listing.url);
    await evalCore(listing);
  }

  function togglePick(url: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  async function handleBatchEvaluate() {
    if (batch.busy) return;
    const targets = listings.filter((j) => picked.has(j.url) && !rows[j.url]?.result);
    if (targets.length === 0) return;
    setBatch({ busy: true, done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await evalCore(targets[i]);
      setBatch((b) => ({ ...b, done: i + 1 }));
    }
    setBatch({ busy: false, done: 0, total: 0 });
    setPicked(new Set());
  }

  // Deterministic per-listing match (blacklist flag + "why it fits" reason),
  // derived from the profile. Computed client-side so results show instantly and
  // the cloud build needs no extra round-trip. Mirrors server/evaluate/match.js.
  // Declared BEFORE blockedCount/ranked because those reference `matches` during
  // render (a later `const` would be a temporal-dead-zone ReferenceError).
  const matches = useMemo(() => {
    const map: Record<string, { blocked: boolean; reason: string }> = {};
    if (profile) {
      for (const l of listings) map[l.url] = matchJob(profile, l);
    }
    return map;
  }, [profile, listings]);

  // Ranked: evaluated jobs first (by fit), then the rest in scan order.
  // Blocked companies are filtered out of the main list (they're flagged + counted).
  const blockedCount = profile ? listings.filter((l) => matchJob(profile, l).blocked).length : 0;
  const ranked = [...listings]
    .filter((l) => !(profile && matches[l.url]?.blocked))
    .sort((a, b) => {
    const fa = GRADE_PCT[(rows[a.url]?.result?.grade || '').toUpperCase()] ?? -1;
    const fb = GRADE_PCT[(rows[b.url]?.result?.grade || '').toUpperCase()] ?? -1;
    return fb - fa;
  });
  const canScan = keyword.trim().length > 0 && !scanning;
  const sel = selected ? { listing: listings.find((l) => l.url === selected), row: rows[selected] } : null;
  const fit = selected ? fitByUrl[selected] ?? null : null;
  // Auto-fetch a salary benchmark once a job is selected + evaluated.
  useEffect(() => {
    if (!sel?.listing || !sel.row?.result) return;
    const url = sel.listing.url;
    if (salaries[url]) return;
    // Kick off the one-time salary fetch for this job; mark busy then resolve async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalaries((prev) => ({ ...prev, [url]: { busy: true, data: null, error: null } }));
    estimateSalary({ title: sel.listing.title, country, city: sel.listing.location || city })
      .then((data) => setSalaries((prev) => ({ ...prev, [url]: { busy: false, data, error: null } })))
      .catch((e) => setSalaries((prev) => ({ ...prev, [url]: { busy: false, data: null, error: e instanceof Error ? e.message : 'n/a' } })));
  }, [sel?.listing, sel?.row?.result, country, city, salaries]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 space-y-5 j4u-rise">
      <PageHeader
        title="Scan GCC boards"
        subtitle="Scan GCC job boards or paste any job link — the copilot scores and tailors each one."
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_372px] gap-[18px] items-start">
        {/* LEFT */}
        <div className="min-w-0 space-y-3.5">
          {/* Search */}
          <form onSubmit={handleScan} aria-label="Job search" className="bg-surface border border-hair-subtle rounded-md p-4 shadow-sm space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <input aria-label="Search keyword" required value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={scanning} placeholder="Role or keyword — e.g. Accountant" className={`${FIELD} w-full`} />
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="scan-country">Country</label>
                <select id="scan-country" aria-label="GCC country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={scanning} className={`${FIELD} flex-1 sm:w-36`}>
                  {GCC_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button type="submit" disabled={!canScan} className="w-full sm:w-auto">
                  {scanning ? (<><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Scanning…</>) : 'Scan new'}
                </Button>
              </div>
            </div>
          </form>

          {/* Paste a job link — now cloud-safe (server fetches + extracts text) */}
          <form onSubmit={handlePasteLink} aria-label="Paste a job link" className="bg-surface border border-hair-subtle rounded-md p-2 shadow-sm flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 flex-none rounded-md bg-surface-sunken text-ink-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </span>
            <input
              aria-label="Job link"
              type="url"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              disabled={pasteBusy}
              placeholder="Paste a job link…"
              className="flex-1 min-w-0 bg-transparent text-ink text-sm px-1 outline-none placeholder:text-ink-muted disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!pasteUrl.trim() || pasteBusy}
              className="inline-flex items-center gap-1.5 flex-none h-9 px-3.5 rounded-md bg-ai-600 text-white text-[12.5px] font-semibold j4u-press j4u-focus hover:bg-ai-700 transition-colors disabled:opacity-60"
            >
              {pasteBusy ? (<><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Adding…</>) : (<><IconSparkle size={14} color="#fff" /> Add &amp; evaluate</>)}
            </button>
          </form>

          {scanError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md bg-warning-soft border border-warning-soft px-3.5 py-3 text-warning-text text-[12.5px]">
              <svg className="flex-none mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
              <span className="min-w-0">{scanError}</span>
            </div>
          )}

          {/* Listings */}
          {hasScanned && !scanning && listings.length > 0 && (
            <>
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[13px] font-bold text-ink-strong">{ranked.length} job{ranked.length !== 1 ? 's' : ''} · auto-evaluated for you</span>
                <span className="text-[11.5px] text-ink-muted">ranked by fit</span>
              </div>

              {blockedCount > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-[12px] text-danger-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
                  {blockedCount} job{blockedCount !== 1 ? 's' : ''} hidden — matched your company blacklist. Edit it on your profile.
                </div>
              )}

              {picked.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hair-subtle bg-surface px-3.5 py-2.5 shadow-sm">
                  <span className="text-[12.5px] font-semibold text-ink-strong">{picked.size} selected</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPicked(new Set())} disabled={batch.busy} className="text-[12px] font-semibold text-ink-muted hover:text-ink-secondary disabled:opacity-50 j4u-focus rounded-sm px-1.5 py-1 transition-colors">Clear</button>
                    <Button onClick={handleBatchEvaluate} disabled={batch.busy}>
                      {batch.busy ? (<><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Scoring {batch.done}/{batch.total}…</>) : `Evaluate selected (${picked.size})`}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {ranked.map((job) => {
                  const r = rows[job.url];
                  const isSel = selected === job.url;
                  const isPicked = picked.has(job.url);
                  const rec = r?.result ? (REC_TONE[r.result.recommendation] ?? { label: r.result.recommendation, tone: 'neutral' as Tone }) : null;
                  const m = matches[job.url];
                  const blocked = !!m?.blocked;
                  return (
                    <div
                      key={job.url}
                      className={`flex items-center gap-2.5 rounded-md border px-3 py-3 transition-colors ${isSel ? 'border-primary-600 bg-primary-50' : blocked ? 'border-danger-soft bg-danger-soft/40' : 'border-hair-subtle bg-surface hover:border-border-strong'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => togglePick(job.url)}
                        aria-label={`Select ${job.title} for batch scoring`}
                        className="flex-none w-4 h-4 accent-primary-600 cursor-pointer j4u-focus rounded-sm"
                      />
                      <button type="button" onClick={() => setSelected(job.url)} className="text-left cursor-pointer flex items-center gap-3 flex-1 min-w-0 j4u-press">
                        {r?.result ? <GradeBadge grade={r.result.grade} /> : (
                          <span className="w-[46px] h-[46px] flex-none rounded-md bg-surface-sunken flex items-center justify-center text-ink-muted">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-semibold text-ink-strong truncate">{job.title}</span>
                          <span className="block text-xs text-ink-muted truncate">
                            {[job.company, job.location].filter(Boolean).join(' · ')}
                            {(() => { const t = sourceTag(job.source); return (
                              <span className={`ml-1.5 inline-flex items-center rounded-pill border px-1.5 py-px text-[10px] font-semibold align-middle ${t.tone}`}>{t.label}</span>
                            ); })()}
                            {job.posted ? ` · ${job.posted}` : ''}
                          </span>
                          {m ? (
                            <span className={`mt-0.5 block text-[11.5px] truncate ${blocked ? 'text-danger-text font-semibold' : 'text-ai-700'}`}>
                              {blocked ? `Blocked — ${job.company} is on your company blacklist` : m.reason}
                            </span>
                          ) : null}
                        </span>
                        {blocked ? (
                          <Badge tone="danger">Blocked</Badge>
                        ) : rec ? <Badge tone={rec.tone}>{rec.label}</Badge> : (
                          <span className="text-[11.5px] font-semibold text-primary-700 shrink-0">{r?.busy ? '…' : 'Evaluate →'}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {hasScanned && !scanning && listings.length === 0 && !scanError && (
            <p className="text-ink-muted text-sm">No listings found. Try a different keyword or country, or paste a job link above.</p>
          )}
        </div>

        {/* RIGHT — copilot */}
        <aside className="lg:sticky lg:top-0 bg-surface border border-ai-soft rounded-md overflow-hidden shadow-md">
          <div className="flex items-center gap-2.5 px-4 py-3 j4u-grad-ai border-b border-ai-soft">
            <IconSparkle size={16} color="var(--ai-600)" />
            <span className="text-[13.5px] font-bold text-ink-strong">Copilot · fit &amp; tailor</span>
          </div>
          <div className="p-4">
            <ScanCopilot sel={sel} salary={selected ? salaries[selected] : undefined} fit={fit} onEvaluate={evaluate} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DimensionBar({ name, grade, weight }: { name: string; grade: string | number; weight?: number }) {
  // Accept either a letter grade (A–F) or a raw 0–100 number.
  const pct = typeof grade === 'number'
    ? Math.max(0, Math.min(100, grade))
    : (GRADE_PCT[String(grade || '').toUpperCase()] ?? 0);
  const tone = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-32 flex-none text-xs text-ink-secondary truncate">{name}</span>
      <span className="flex-1 h-1.5 rounded-pill bg-surface-sunken overflow-hidden">
        <span className="block h-full rounded-pill" style={{ width: `${pct}%`, background: tone, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
      </span>
      <span className="w-9 flex-none text-right text-[11px] font-bold text-ink-strong tabular-nums">{typeof grade === 'number' ? `${Math.round(pct)}%` : grade}</span>
      {weight != null && <span className="w-9 flex-none text-right text-[10px] text-ink-muted tabular-nums">{Math.round(weight * 100)}%</span>}
    </div>
  );
}

function SalaryBenchmark({ salary, country }: { salary?: SalaryState; country?: string }) {
  if (!salary || salary.busy) {
    return <div className="text-[11.5px] text-ink-muted">Estimating typical pay…</div>;
  }
  if (salary.error || !salary.data || (salary.data.low == null && salary.data.high == null)) {
    return <div className="text-[11.5px] text-ink-muted">{salary?.data?.note || 'Not enough data to estimate pay for this role.'}</div>;
  }
  const { low, high, currency, period } = salary.data;
  const fmt = (n: number | null) => (n == null ? '—' : `${currency} ${n >= 1000 ? `${Math.round(n / 100) / 10}k` : n}`);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold text-ink-strong tabular-nums">{fmt(low)} – {fmt(high)}</span>
        <span className="text-[11px] text-ink-muted">/ {period}</span>
      </div>
      <span className="mt-1.5 block h-1.5 rounded-pill bg-gradient-to-r from-ai-soft to-ai-600" />
      <div className="mt-1 text-[10.5px] text-ink-muted">AI estimate{country ? ` · ${country}` : ''} — not live data.</div>
    </div>
  );
}

function ScanCopilot({ sel, salary, fit, onEvaluate }: { sel: { listing?: Listing; row?: RowState } | null; salary?: SalaryState; fit: FitScore | null; onEvaluate: (l: Listing) => void }) {
  if (!sel?.listing) {
    return <p className="text-[13px] text-ink-muted leading-relaxed">Run a scan or paste a job link, then pick a job on the left. I'll score its fit, break it down dimension by dimension, estimate the pay, and tailor your CV for it.</p>;
  }
  const { listing, row } = sel;
  const result = row?.result;
  const strong = result ? (GRADE_PCT[(result.grade || '').toUpperCase()] ?? 0) >= 80 : false;

  const [opt, setOpt] = useState<{ busy: boolean; data: ResumeOptimization | null; error: string | null }>({ busy: false, data: null, error: null });
  async function runOptimize() {
    const jobText = [
      listing?.title && `Job Title: ${listing.title}`,
      listing?.company && `Company: ${listing.company}`,
      listing?.location && `Location: ${listing.location}`,
    ].filter(Boolean).join('\n');
    setOpt({ busy: true, data: null, error: null });
    try {
      const data = await optimizeResume(jobText);
      setOpt({ busy: false, data, error: null });
    } catch (e) {
      setOpt({ busy: false, data: null, error: e instanceof Error ? e.message : 'Could not generate suggestions.' });
    }
  }

  const [brief, setBrief] = useState<{ busy: boolean; data: CompanyBrief | null; error: string | null }>({ busy: false, data: null, error: null });
  async function runResearch() {
    if (!listing.company) return;
    setBrief({ busy: true, data: null, error: null });
    try {
      const data = await researchCompany(listing.company);
      setBrief({ busy: false, data, error: null });
    } catch (e) {
      setBrief({ busy: false, data: null, error: e instanceof Error ? e.message : 'Could not research this company.' });
    }
  }

  return (
    <div>
      <div className="text-[13.5px] font-semibold text-ink-strong leading-snug truncate">{listing.title}</div>
      <div className="text-xs text-ink-muted mt-0.5 truncate">{[listing.company, listing.location].filter(Boolean).join(' · ')}{listing.salary ? ` · ${listing.salary}` : ''}</div>

      {!result && (
        <Button onClick={() => onEvaluate(listing)} disabled={row?.busy} className="w-full mt-4">
          {row?.busy ? 'Evaluating…' : 'Evaluate this job'}
        </Button>
      )}
      {row?.error && <p role="alert" className="text-xs text-danger-text mt-2">{row.error}</p>}

      {result && (
        <div className="j4u-rise mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <GradeBadge grade={result.grade} />
            <div className="min-w-0">
              {(() => { const rec = REC_TONE[result.recommendation] ?? { label: result.recommendation, tone: 'neutral' as Tone }; return (
                <div className="flex items-center gap-1.5">
                  <Badge tone={rec.tone}>{rec.label}</Badge>
                  {strong && <span className="text-[10px] font-bold uppercase tracking-wide text-ai-700">Strong match</span>}
                </div>
              ); })()}
              <p className="text-[12px] text-ink-secondary mt-1.5 leading-snug">{result.summary}</p>
            </div>
          </div>

          {result.dimensions?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-2">Dimension by dimension</div>
              <div className="flex flex-col gap-2">
                {result.dimensions.map((d, i) => <DimensionBar key={i} name={d.name} grade={d.score} />)}
              </div>
            </div>
          )}

          {fit && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Weighted fit (instant, no AI)</div>
                <div className="text-[11px] font-bold text-ink-strong tabular-nums">{fit.score}% <span className="font-normal text-ink-muted">· {fit.verdict}</span></div>
              </div>
              <div className="flex flex-col gap-2">
                {fit.dimensions.map((d, i) => <DimensionBar key={i} name={d.name} grade={d.score} weight={d.weight} />)}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[9.5px] text-ink-muted">
                <span>Bars = match score</span><span>Right = weight %</span>
              </div>
            </div>
          )}

          {fit?.missingSkills && fit.missingSkills.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-warning-text mb-1.5">Skills to build</div>
              <div className="flex flex-wrap gap-1.5">
                {fit.missingSkills.slice(0, 8).map((s) => (
                  <span key={s} className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-warning-soft text-warning-text">{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.missingSkills?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-warning-text mb-1.5">Worth strengthening</div>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.slice(0, 6).map((s) => (
                  <a key={s} href={learningLinks(s)[0].url} target="_blank" rel="noreferrer" className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-warning-soft text-warning-text hover:underline j4u-focus">{s} ↗</a>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Salary benchmark</div>
            <SalaryBenchmark salary={salary} country={listing.location || undefined} />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={runOptimize}
              disabled={opt.busy}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 h-10 rounded-md border border-hair bg-surface text-ink-strong text-[13px] font-semibold j4u-press j4u-focus hover:bg-surface-sunken transition-colors disabled:opacity-60"
            >
              <IconSparkle size={15} />{opt.busy ? 'Analyzing your CV…' : 'Suggest CV improvements'}
            </button>
            {opt.error && <p role="alert" className="text-xs text-danger-text">{opt.error}</p>}
            {opt.data && (
              <div className="mt-1 space-y-3">
                {opt.data.content_suggestions?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Rewrite suggestions</div>
                    <div className="space-y-2">
                      {opt.data.content_suggestions.slice(0, 6).map((s, i) => (
                        <div key={i} className="rounded-md border border-hair bg-surface-sunken p-2.5">
                          <div className="text-[11px] font-semibold text-ink-strong">{s.section}</div>
                          <div className="mt-1 text-[11px] text-ink-muted line-through">{s.before}</div>
                          <div className="text-[11.5px] text-ink-secondary">{s.after}</div>
                          <div className="mt-1 text-[10.5px] text-ai-700">{s.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {opt.data.skills_to_highlight?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Skills to highlight</div>
                    <div className="flex flex-wrap gap-1.5">{opt.data.skills_to_highlight.slice(0, 8).map((s, i) => <span key={i} className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-ai-soft text-ai-700">{s}</span>)}</div>
                  </div>
                )}
                {opt.data.keywords_for_ats?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">ATS keywords to add</div>
                    <div className="flex flex-wrap gap-1.5">{opt.data.keywords_for_ats.slice(0, 10).map((s, i) => <span key={i} className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-surface-sunken text-ink-secondary">{s}</span>)}</div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={runResearch}
              disabled={brief.busy || !listing.company}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 h-10 rounded-md border border-hair bg-surface text-ink-strong text-[13px] font-semibold j4u-press j4u-focus hover:bg-surface-sunken transition-colors disabled:opacity-60"
            >
              <IconSparkle size={15} />{brief.busy ? 'Researching…' : listing.company ? `Research ${listing.company}` : 'Research company'}
            </button>
            {brief.error && <p role="alert" className="text-xs text-danger-text">{brief.error}</p>}
            {brief.data && (
              <div className="mt-1 space-y-3">
                {brief.data.snapshot && <p className="text-[12px] text-ink-secondary leading-snug">{brief.data.snapshot}</p>}
                {brief.data.market_position && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">Market position</div>
                    <p className="text-[11.5px] text-ink-secondary leading-snug">{brief.data.market_position}</p>
                  </div>
                )}
                {brief.data.culture_signals?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Culture signals</div>
                    <div className="flex flex-wrap gap-1.5">{brief.data.culture_signals.map((s, i) => <span key={i} className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-surface-sunken text-ink-secondary">{s}</span>)}</div>
                  </div>
                )}
                {brief.data.interview_questions?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Likely interview questions</div>
                    <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-ink-secondary">{brief.data.interview_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            <Link to={`/evaluate?eval=${result.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-ai-600 text-white text-[13px] font-semibold j4u-press j4u-focus hover:bg-ai-700 transition-colors"><IconSparkle size={15} color="#fff" />Open tailored CV &amp; cover letter</Link>
            <Link to="/auto-apply" className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-primary-600 text-white text-[13px] font-semibold j4u-press j4u-focus hover:bg-primary-700 transition-colors">Apply now on Auto-apply →</Link>
            {listing.url && !listing.url.startsWith('pasted:') && <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-9 rounded-md border border-hair text-ink-strong text-xs font-semibold j4u-press j4u-focus hover:bg-surface-sunken transition-colors">Open the listing ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}
