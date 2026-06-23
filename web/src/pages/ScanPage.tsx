import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  scan,
  evaluateListing,
  listBoards,
  type Board,
  type Listing,
} from '../features/scanner/scannerApi';
import { loadScanState, saveScanState, defaultScanState, type RowState } from '../features/scanner/scanStore';
import { PageHeader, Button, Badge, GradeBadge, type Tone } from '../components/ui';
import { RadialGauge } from '../components/charts';
import { learningLinks } from '../lib/skills';
import { IconSparkle } from '../components/icons';

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];
const BOARDS_STATIC: Board[] = [{ id: 'indeed', name: 'Indeed', status: 'verified' }];
const GRADE_PCT: Record<string, number> = { A: 92, B: 82, C: 68, D: 52, F: 35 };
const FIELD = 'mt-1 w-full rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60';
const REC_TONE: Record<string, { label: string; tone: Tone }> = {
  apply: { label: 'Apply', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  skip: { label: 'Skip', tone: 'danger' },
};

export default function ScanPage() {
  // Restore the last scan (listings + evaluations + selection) so it survives navigation.
  const initial = useMemo(() => loadScanState(defaultScanState(BOARDS_STATIC[0].id, GCC_COUNTRIES[0])), []);

  const [boards, setBoards] = useState<Board[]>(BOARDS_STATIC);
  useEffect(() => { listBoards().then(setBoards).catch(() => {}); }, []);
  const [selectedBoard, setSelectedBoard] = useState(initial.board);
  const [keyword, setKeyword] = useState(initial.keyword);
  const [country, setCountry] = useState(initial.country);
  const [city, setCity] = useState(initial.city);

  const [scanning, setScanning] = useState(false);
  const [listings, setListings] = useState<Listing[]>(initial.listings);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(initial.hasScanned);
  const [rows, setRows] = useState<Record<string, RowState>>(initial.rows);
  const [selected, setSelected] = useState<string | null>(initial.selected);

  // Persist across navigation / reload (within the tab session).
  useEffect(() => {
    saveScanState({ board: selectedBoard, keyword, country, city, listings, rows, selected, hasScanned });
  }, [selectedBoard, keyword, country, city, listings, rows, selected, hasScanned]);

  const activeBoard = boards.find((b) => b.id === selectedBoard);

  function setRow(url: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [url]: { ...(prev[url] ?? { busy: false, result: null, error: null }), ...patch } }));
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || scanning) return;
    setScanning(true); setScanError(null); setListings([]); setRows({}); setSelected(null); setHasScanned(false);
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

  async function evaluate(listing: Listing) {
    const key = listing.url;
    setSelected(key);
    setRow(key, { busy: true, error: null, result: null });
    try {
      const result = await evaluateListing(listing);
      setRow(key, { busy: false, result, error: null });
    } catch (e) {
      setRow(key, { busy: false, result: null, error: e instanceof Error ? e.message : 'Evaluation failed.' });
    }
  }

  // Ranked: evaluated jobs first (by fit), then the rest in scan order.
  const ranked = [...listings].sort((a, b) => {
    const fa = GRADE_PCT[(rows[a.url]?.result?.grade || '').toUpperCase()] ?? -1;
    const fb = GRADE_PCT[(rows[b.url]?.result?.grade || '').toUpperCase()] ?? -1;
    return fb - fa;
  });
  const canScan = keyword.trim().length > 0 && !scanning;
  const sel = selected ? { listing: listings.find((l) => l.url === selected), row: rows[selected] } : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scan GCC boards"
        subtitle="Search Indeed for GCC roles, then let the copilot score and tailor each one. A browser window opens briefly while we fetch — that's normal."
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_372px] gap-[18px] items-start">
        {/* LEFT: search + listing */}
        <div className="min-w-0 space-y-4">
          {/* search card */}
          <div className="bg-surface border border-hair-subtle rounded-md p-4 shadow-sm">
            <form onSubmit={handleScan} aria-label="Job search form" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Job board</span>
                  <div className="mt-1 flex items-center gap-2">
                    <select aria-label="Job board" value={selectedBoard} onChange={(e) => setSelectedBoard(e.target.value)} disabled={scanning} className="flex-1 rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus disabled:opacity-60">
                      {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {activeBoard?.status && <Badge tone={activeBoard.status === 'experimental' ? 'warning' : 'success'}>{activeBoard.status}</Badge>}
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Keyword <span aria-hidden="true">*</span></span>
                  <input aria-label="Search keyword" required type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={scanning} placeholder="e.g. Accountant" className={FIELD} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">Country</span>
                  <select aria-label="GCC country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={scanning} className={FIELD}>
                    {GCC_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-secondary">City (optional)</span>
                  <input aria-label="City (optional)" type="text" value={city} onChange={(e) => setCity(e.target.value)} disabled={scanning} placeholder="e.g. Dubai" className={FIELD} />
                </label>
              </div>
              <Button type="submit" disabled={!canScan} className="w-full sm:w-auto">
                {scanning ? (
                  <><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Scanning…</>
                ) : 'Scan now'}
              </Button>
            </form>
          </div>

          {scanError && (
            <div role="alert" className="flex items-center gap-2.5 rounded-[11px] bg-warning-soft border border-warning-soft px-3.5 py-3 text-warning-text text-[12.5px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
              {scanError}
            </div>
          )}

          {/* listing */}
          {hasScanned && !scanning && listings.length > 0 && (
            <>
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[13px] font-bold text-ink-strong">{listings.length} job{listings.length !== 1 ? 's' : ''} found</span>
                <span className="text-[11.5px] text-ink-muted">evaluated jobs ranked by fit</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {ranked.map((job) => {
                  const r = rows[job.url];
                  const isSel = selected === job.url;
                  const rec = r?.result ? (REC_TONE[r.result.recommendation] ?? { label: r.result.recommendation, tone: 'neutral' as Tone }) : null;
                  return (
                    <button
                      key={job.url}
                      onClick={() => setSelected(job.url)}
                      className={`text-left cursor-pointer flex items-center gap-3 rounded-md border px-3.5 py-3 j4u-press ${isSel ? 'border-primary-600 bg-primary-50' : 'border-hair-subtle bg-surface'}`}
                    >
                      {r?.result ? <GradeBadge grade={r.result.grade} /> : (
                        <span className="w-[46px] h-[46px] flex-none rounded-md bg-surface-sunken flex items-center justify-center text-ink-muted text-lg">·</span>
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
                  );
                })}
              </div>
            </>
          )}

          {hasScanned && !scanning && listings.length === 0 && !scanError && (
            <p className="text-ink-muted text-sm">No listings found. Try a different keyword or country.</p>
          )}
        </div>

        {/* RIGHT: copilot fit & tailor */}
        <aside className="lg:sticky lg:top-0 bg-surface border border-ai-soft rounded-md overflow-hidden shadow-md">
          <div className="flex items-center gap-2.5 px-4 py-3 j4u-grad-ai border-b border-ai-soft">
            <IconSparkle size={16} color="var(--ai-600)" />
            <span className="text-[13.5px] font-bold text-ink-strong">Copilot · fit &amp; tailor</span>
          </div>
          <div className="p-4">
            <ScanCopilot sel={sel} onEvaluate={evaluate} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ScanCopilot({ sel, onEvaluate }: { sel: { listing?: Listing; row?: RowState } | null; onEvaluate: (l: Listing) => void }) {
  if (!sel?.listing) {
    return <p className="text-[13px] text-ink-muted leading-relaxed">Run a scan, then pick a job on the left. I'll score its fit, break it down dimension by dimension, and tailor your CV for it.</p>;
  }
  const { listing, row } = sel;
  const result = row?.result;

  return (
    <div>
      <div className="text-[13.5px] font-semibold text-ink-strong leading-snug">{listing.title}</div>
      <div className="text-xs text-ink-muted mt-0.5">{[listing.company, listing.location].filter(Boolean).join(' · ')}{listing.salary ? ` · ${listing.salary}` : ''}</div>

      {!result && (
        <Button onClick={() => onEvaluate(listing)} disabled={row?.busy} className="w-full mt-4">
          {row?.busy ? 'Evaluating…' : 'Evaluate this job'}
        </Button>
      )}
      {row?.error && <p role="alert" className="text-xs text-danger-text mt-2">{row.error}</p>}

      {result && (
        <div className="j4u-rise mt-4">
          <div className="flex items-center gap-4">
            <RadialGauge value={GRADE_PCT[(result.grade || '').toUpperCase()] ?? 0} size={72} stroke={7} color="var(--ai-600)">
              <span className="text-base font-bold text-ink-strong">{result.grade}</span>
            </RadialGauge>
            <div>
              {(() => { const rec = REC_TONE[result.recommendation] ?? { label: result.recommendation, tone: 'neutral' as Tone }; return <Badge tone={rec.tone}>{rec.label}</Badge>; })()}
              <p className="text-[12px] text-ink-secondary mt-1.5 leading-snug">{result.summary}</p>
            </div>
          </div>

          {result.dimensions?.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mt-4 mb-2">Dimension by dimension</div>
              <div className="flex flex-col gap-1.5">
                {result.dimensions.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border border-hair-subtle rounded-md px-2.5 py-1.5">
                    <span className="text-xs text-ink-secondary truncate">{d.name}</span>
                    <GradeBadge grade={d.score} size="sm" />
                  </div>
                ))}
              </div>
            </>
          )}

          {result.missingSkills?.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wide text-warning-text mt-4 mb-1.5">Worth strengthening</div>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.slice(0, 6).map((s) => (
                  <a key={s} href={learningLinks(s)[0].url} target="_blank" rel="noreferrer" className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-warning-soft text-warning-text hover:underline">{s} ↗</a>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-2 mt-4">
            <Link to={`/documents?eval=${result.id}`} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-ai-600 text-white text-[13px] font-semibold j4u-press">✨ Tailor my CV for this job</Link>
            {listing.url && <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-9 rounded-md border border-hair text-ink-strong text-xs font-semibold j4u-press">Open the listing ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}
