import { useState, useEffect } from 'react';
import {
  scan,
  evaluateListing,
  listBoards,
  type Board,
  type Listing,
  type EvaluationResult,
} from '../features/scanner/scannerApi';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Button, Badge, GradeBadge, type Tone } from '../components/ui';
import { learningLinks } from '../lib/skills';

const REC_TONE: Record<string, { label: string; tone: Tone }> = {
  apply: { label: 'Apply', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  skip: { label: 'Skip', tone: 'danger' },
};

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];

const BOARDS_STATIC: Board[] = [{ id: 'indeed', name: 'Indeed', status: 'verified' }];

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted disabled:opacity-60';

interface RowState {
  busy: boolean;
  result: EvaluationResult | null;
  error: string | null;
}

export default function ScanPage() {
  const [boards, setBoards] = useState<Board[]>(BOARDS_STATIC);
  useEffect(() => { listBoards().then(setBoards).catch(() => {}); }, []);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS_STATIC[0].id);
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState(GCC_COUNTRIES[0]);
  const [city, setCity] = useState('');

  const [scanning, setScanning] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Per-row evaluate state: listing url → RowState
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  function setRowState(url: string, patch: Partial<RowState>) {
    setRowStates((prev) => {
      const existing = prev[url] ?? { busy: false, result: null, error: null };
      return { ...prev, [url]: { ...existing, ...patch } };
    });
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || scanning) return;
    setScanning(true);
    setScanError(null);
    setListings([]);
    setRowStates({});
    setHasScanned(false);
    try {
      const result = await scan({ board: selectedBoard, keyword: keyword.trim(), country, city: city.trim() || undefined });
      setListings(result.listings);
      if (result.error && result.listings.length === 0) {
        setScanError(result.error);
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
      setHasScanned(true);
    }
  }

  async function handleEvaluate(listing: Listing) {
    const key = listing.url;
    setRowState(key, { busy: true, error: null, result: null });
    try {
      const result: EvaluationResult = await evaluateListing(listing);
      setRowState(key, { busy: false, result, error: null });
    } catch (e) {
      setRowState(key, {
        busy: false,
        result: null,
        error: e instanceof Error ? e.message : 'Evaluation failed.',
      });
    }
  }

  const canScan = keyword.trim().length > 0 && !scanning;
  const activeBoard = boards.find((b) => b.id === selectedBoard);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan GCC boards"
        subtitle="Search Indeed for GCC roles and evaluate them instantly. A browser window opens briefly while we fetch listings — that's normal."
      />

      {/* Search form */}
      <Card>
        <form onSubmit={handleScan} className="space-y-4" aria-label="Job search form">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Job board</span>
              <select aria-label="Job board" value={selectedBoard} onChange={(e) => setSelectedBoard(e.target.value)} disabled={scanning} className={FIELD}>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {activeBoard?.status && (
                <span className="mt-1.5 inline-block">
                  <Badge tone={activeBoard.status === 'experimental' ? 'warning' : 'success'}>
                    {activeBoard.status}
                  </Badge>
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Keyword <span aria-hidden="true">*</span></span>
              <input aria-label="Search keyword" required type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={scanning} placeholder="e.g. Accountant" className={FIELD} />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">Country</span>
              <select aria-label="GCC country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={scanning} className={FIELD}>
                {GCC_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-secondary">City (optional)</span>
              <input aria-label="City (optional)" type="text" value={city} onChange={(e) => setCity(e.target.value)} disabled={scanning} placeholder="e.g. Dubai" className={FIELD} />
            </label>
          </div>

          <Button type="submit" disabled={!canScan}>
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </form>
      </Card>

      {/* Board-level error (graceful degradation) */}
      {scanError && (
        <div role="alert" className="rounded-xl bg-warning-soft border border-warning-soft p-4 text-warning-text text-sm">
          {scanError}
        </div>
      )}

      {/* Results */}
      {hasScanned && !scanning && (
        <section aria-label="Search results">
          {listings.length === 0 && !scanError && (
            <p className="text-ink-muted text-sm">No listings found. Try a different keyword or country.</p>
          )}

          {listings.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">{listings.length} listing{listings.length !== 1 ? 's' : ''} found</p>
              <ul className="space-y-2" aria-label="Job listings">
                {listings.map((listing, idx) => {
                  const rowKey = listing.url || String(idx);
                  const row = rowStates[rowKey] ?? { busy: false, grade: null, error: null };
                  return (
                    <li key={rowKey} className="bg-surface rounded-xl shadow-sm border border-hair-subtle p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink-strong text-sm leading-snug">{listing.title}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {[listing.company, listing.location].filter(Boolean).join(' · ')}
                          </p>
                          {(listing.salary || listing.posted) && (
                            <p className="text-xs text-ink-muted mt-0.5">
                              {[listing.salary, listing.posted].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {listing.url && (
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${listing.title} on ${listing.source}`}
                              className="mt-1 inline-block text-xs font-semibold text-primary-700 hover:underline"
                            >
                              Open listing ↗
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {row.result && <GradeBadge grade={row.result.grade} size="sm" />}
                          {row.error && <span role="alert" className="text-xs text-danger-text">{row.error}</span>}
                          <Button variant="secondary" size="sm" onClick={() => handleEvaluate(listing)} disabled={row.busy} aria-label={`Evaluate ${listing.title}`}>
                            {row.busy ? 'Evaluating…' : row.result ? 'Re-evaluate' : 'Evaluate'}
                          </Button>
                        </div>
                      </div>
                      {row.result && <EvalPanel result={row.result} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EvalPanel({ result }: { result: EvaluationResult }) {
  const rec = REC_TONE[result.recommendation] ?? { label: result.recommendation, tone: 'neutral' as Tone };
  return (
    <div className="mt-3 pt-3 border-t border-hair-subtle j4u-rise">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={rec.tone}>{rec.label}</Badge>
        <span className="text-xs text-ink-muted">AI graded this <b className="text-ink-secondary">{result.grade}</b></span>
      </div>
      {result.summary && <p className="text-[13px] text-ink-secondary mt-2 leading-relaxed">{result.summary}</p>}

      {result.dimensions?.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mt-3 mb-2">Dimension by dimension</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.dimensions.map((d, i) => (
              <div key={i} className="border border-hair-subtle rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-secondary">{d.name}</span>
                  <GradeBadge grade={d.score} size="sm" />
                </div>
                {d.comment && <p className="text-[11px] text-ink-muted mt-1 leading-snug">{d.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {result.missingSkills?.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wide text-warning-text mt-3 mb-1.5">Worth strengthening</div>
          <div className="flex flex-wrap gap-1.5">
            {result.missingSkills.slice(0, 6).map((s) => (
              <a key={s} href={learningLinks(s)[0].url} target="_blank" rel="noreferrer" className="text-[11px] font-medium px-2.5 py-0.5 rounded-pill bg-warning-soft text-warning-text hover:underline">{s} ↗</a>
            ))}
          </div>
        </>
      )}

      <Link to={`/documents?eval=${result.id}`} className="inline-flex items-center gap-1.5 mt-3 h-9 px-3 rounded-lg bg-ai-soft text-ai-700 text-xs font-semibold j4u-press">✨ Tailor CV for this job →</Link>
    </div>
  );
}
