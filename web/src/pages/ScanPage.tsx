import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  scan,
  evaluateListing,
  evaluateJobText,
  fetchJobFromUrl,
  estimateSalary,
  listBoards,
  type Board,
  type Listing,
  type SalaryEstimate,
} from '../features/scanner/scannerApi';
import { loadScanState, saveScanState, defaultScanState, type RowState } from '../features/scanner/scanStore';
import { PageHeader, Button, Badge, GradeBadge, type Tone } from '../components/ui';
import { learningLinks } from '../lib/skills';
import { IconSparkle } from '../components/icons';

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];
const BOARDS_STATIC: Board[] = [{ id: 'indeed', name: 'Indeed', status: 'verified' }];
// Board chips shown in the design — Indeed is live; the rest are coming soon.
const CHIP_BOARDS = [
  { id: 'indeed', name: 'Indeed' },
  { id: 'bayt', name: 'Bayt' },
  { id: 'naukrigulf', name: 'Naukrigulf' },
  { id: 'gulftalent', name: 'GulfTalent' },
];
const GRADE_PCT: Record<string, number> = { A: 92, B: 82, C: 68, D: 52, F: 35 };
const FIELD = 'rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60';
const REC_TONE: Record<string, { label: string; tone: Tone }> = {
  apply: { label: 'Apply', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  skip: { label: 'Skip', tone: 'danger' },
};

interface SalaryState { busy: boolean; data: SalaryEstimate | null; error: string | null; }

export default function ScanPage() {
  const initial = useMemo(() => loadScanState(defaultScanState(BOARDS_STATIC[0].id, GCC_COUNTRIES[0])), []);

  const [boards, setBoards] = useState<Board[]>(BOARDS_STATIC);
  useEffect(() => { listBoards().then(setBoards).catch(() => {}); }, []);
  const [selectedBoard, setSelectedBoard] = useState(initial.board);
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

  useEffect(() => {
    saveScanState({ board: selectedBoard, keyword, country, city, listings, rows, selected, hasScanned });
  }, [selectedBoard, keyword, country, city, listings, rows, selected, hasScanned]);

  function setRow(url: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [url]: { ...(prev[url] ?? { busy: false, result: null, error: null }), ...patch } }));
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || scanning) return;
    setScanning(true); setScanError(null); setListings([]); setRows({}); setSelected(null); setHasScanned(false); setPicked(new Set());
    try {
      const result = await scan({ board: selectedBoard, keyword: keyword.trim(), country, city: city.trim() || undefined });
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
    try {
      const result = await evaluateListing(listing);
      setRow(key, { busy: false, result, error: null });
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

  // Ranked: evaluated jobs first (by fit), then the rest in scan order.
  const ranked = [...listings].sort((a, b) => {
    const fa = GRADE_PCT[(rows[a.url]?.result?.grade || '').toUpperCase()] ?? -1;
    const fb = GRADE_PCT[(rows[b.url]?.result?.grade || '').toUpperCase()] ?? -1;
    return fb - fa;
  });
  const canScan = keyword.trim().length > 0 && !scanning;
  const sel = selected ? { listing: listings.find((l) => l.url === selected), row: rows[selected] } : null;

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
    <div className="space-y-5 j4u-rise">
      <PageHeader
        title="Scan GCC boards"
        subtitle="Search Indeed, or paste a job link — the copilot scores and tailors each one. A browser window opens briefly while we fetch."
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_372px] gap-[18px] items-start">
        {/* LEFT */}
        <div className="min-w-0 space-y-3.5">
          {/* Search */}
          <form onSubmit={handleScan} aria-label="Job search" className="bg-surface border border-hair-subtle rounded-md p-4 shadow-sm space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <input aria-label="Search keyword" required value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={scanning} placeholder="Role or keyword — e.g. Accountant" className={`${FIELD} w-full`} />
              <div className="flex gap-2.5">
                <label className="sr-only" htmlFor="scan-country">Country</label>
                <select id="scan-country" aria-label="GCC country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={scanning} className={`${FIELD} flex-1 sm:w-36`}>
                  {GCC_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button type="submit" disabled={!canScan}>
                  {scanning ? (<><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Scanning…</>) : 'Scan new'}
                </Button>
              </div>
            </div>
            {/* Board chips — Indeed live, others coming soon */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Boards</span>
              {CHIP_BOARDS.map((b) => {
                const live = boards.some((x) => x.id === b.id && (x.status === 'verified' || x.status === 'production'));
                const active = selectedBoard === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => live && setSelectedBoard(b.id)}
                    disabled={!live}
                    aria-pressed={active}
                    title={live ? `Search ${b.name}` : `${b.name} — coming soon`}
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors j4u-focus ${
                      active ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : live ? 'border-hair bg-surface text-ink-secondary hover:border-border-strong'
                      : 'border-hair-subtle bg-surface-sunken text-ink-muted cursor-not-allowed'
                    }`}
                  >
                    {b.name}
                    {!live && <span className="text-[10px] font-medium text-ink-muted">soon</span>}
                  </button>
                );
              })}
            </div>
          </form>

          {/* Paste a job link */}
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
                <span className="text-[13px] font-bold text-ink-strong">{listings.length} job{listings.length !== 1 ? 's' : ''} · auto-evaluated for you</span>
                <span className="text-[11.5px] text-ink-muted">ranked by fit</span>
              </div>

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
                  return (
                    <div
                      key={job.url}
                      className={`flex items-center gap-2.5 rounded-md border px-3 py-3 transition-colors ${isSel ? 'border-primary-600 bg-primary-50' : 'border-hair-subtle bg-surface hover:border-border-strong'}`}
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
                            {[job.company, job.location].filter(Boolean).join(' · ')} · <span className="font-mono text-[11px]">{job.source}</span>{job.posted ? ` · ${job.posted}` : ''}
                          </span>
                        </span>
                        {rec ? <Badge tone={rec.tone}>{rec.label}</Badge> : (
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
            <ScanCopilot sel={sel} salary={selected ? salaries[selected] : undefined} onEvaluate={evaluate} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DimensionBar({ name, grade }: { name: string; grade: string }) {
  const pct = GRADE_PCT[(grade || '').toUpperCase()] ?? 0;
  const tone = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-28 flex-none text-xs text-ink-secondary truncate">{name}</span>
      <span className="flex-1 h-1.5 rounded-pill bg-surface-sunken overflow-hidden">
        <span className="block h-full rounded-pill" style={{ width: `${pct}%`, background: tone, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
      </span>
      <span className="w-5 flex-none text-right text-[11px] font-bold text-ink-strong tabular-nums">{grade}</span>
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

function ScanCopilot({ sel, salary, onEvaluate }: { sel: { listing?: Listing; row?: RowState } | null; salary?: SalaryState; onEvaluate: (l: Listing) => void }) {
  if (!sel?.listing) {
    return <p className="text-[13px] text-ink-muted leading-relaxed">Run a scan or paste a job link, then pick a job on the left. I'll score its fit, break it down dimension by dimension, estimate the pay, and tailor your CV for it.</p>;
  }
  const { listing, row } = sel;
  const result = row?.result;
  const strong = result ? (GRADE_PCT[(result.grade || '').toUpperCase()] ?? 0) >= 80 : false;

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
            <Link to={`/documents?eval=${result.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-ai-600 text-white text-[13px] font-semibold j4u-press j4u-focus hover:bg-ai-700 transition-colors"><IconSparkle size={15} color="#fff" />Open tailored CV &amp; cover letter</Link>
            <Link to="/auto-apply" className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-primary-600 text-white text-[13px] font-semibold j4u-press j4u-focus hover:bg-primary-700 transition-colors">Apply now on Auto-apply →</Link>
            {listing.url && !listing.url.startsWith('pasted:') && <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-9 rounded-md border border-hair text-ink-strong text-xs font-semibold j4u-press j4u-focus hover:bg-surface-sunken transition-colors">Open the listing ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}
