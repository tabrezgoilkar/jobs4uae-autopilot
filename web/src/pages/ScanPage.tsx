import { useState, useEffect } from 'react';
import {
  scan,
  evaluateListing,
  listBoards,
  type Board,
  type Listing,
  type EvaluationResult,
} from '../features/scanner/scannerApi';

const GCC_COUNTRIES = [
  'UAE',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
];

const BOARDS_STATIC: Board[] = [
  { id: 'bayt', name: 'Bayt.com' },
  { id: 'naukrigulf', name: 'Naukrigulf' },
];

interface RowState {
  busy: boolean;
  grade: string | null;
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
      const existing = prev[url] ?? { busy: false, grade: null, error: null };
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
    setRowState(key, { busy: true, error: null, grade: null });
    try {
      const result: EvaluationResult = await evaluateListing(listing);
      setRowState(key, { busy: false, grade: result.grade ?? 'N/A', error: null });
    } catch (e) {
      setRowState(key, {
        busy: false,
        grade: null,
        error: e instanceof Error ? e.message : 'Evaluation failed.',
      });
    }
  }

  const canScan = keyword.trim().length > 0 && !scanning;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Find Jobs</h1>
        <p className="mt-1 text-slate-600">
          Search Bayt.com and Naukrigulf for GCC roles and evaluate them instantly.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleScan}
        className="bg-white rounded-2xl shadow p-6 space-y-4"
        aria-label="Job search form"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Board */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Job board</span>
            <select
              aria-label="Job board"
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              disabled={scanning}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* Keyword */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Keyword <span aria-hidden="true">*</span>
            </span>
            <input
              aria-label="Search keyword"
              required
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={scanning}
              placeholder="e.g. Accountant"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>

          {/* Country */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Country</span>
            <select
              aria-label="GCC country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={scanning}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            >
              {GCC_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* City (optional) */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">City (optional)</span>
            <input
              aria-label="City (optional)"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={scanning}
              placeholder="e.g. Dubai"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!canScan}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </form>

      {/* Board-level error (graceful degradation) */}
      {scanError && (
        <div role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
          {scanError}
        </div>
      )}

      {/* Results */}
      {hasScanned && !scanning && (
        <section aria-label="Search results">
          {listings.length === 0 && !scanError && (
            <p className="text-slate-500 text-sm">No listings found. Try a different keyword or country.</p>
          )}

          {listings.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{listings.length} listing{listings.length !== 1 ? 's' : ''} found</p>
              <ul className="space-y-2" aria-label="Job listings">
                {listings.map((listing, idx) => {
                  const rowKey = listing.url || String(idx);
                  const row = rowStates[rowKey] ?? { busy: false, grade: null, error: null };
                  return (
                    <li
                      key={rowKey}
                      className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      {/* Listing details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm leading-snug">{listing.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[listing.company, listing.location].filter(Boolean).join(' · ')}
                        </p>
                        {listing.url && (
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${listing.title} on ${listing.source}`}
                            className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                          >
                            Open listing
                          </a>
                        )}
                      </div>

                      {/* Evaluate */}
                      <div className="flex items-center gap-3 shrink-0">
                        {row.grade && (
                          <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            Graded: {row.grade}
                          </span>
                        )}
                        {row.error && (
                          <span role="alert" className="text-xs text-red-600">
                            {row.error}
                          </span>
                        )}
                        <button
                          onClick={() => handleEvaluate(listing)}
                          disabled={row.busy}
                          aria-label={`Evaluate ${listing.title}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium disabled:opacity-50 hover:bg-slate-700"
                        >
                          {row.busy ? 'Evaluating…' : row.grade ? 'Re-evaluate' : 'Evaluate'}
                        </button>
                      </div>
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
