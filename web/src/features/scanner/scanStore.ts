// Session-persistent Scan state, so listings + evaluations + selection survive
// navigating away and back (and a reload within the tab). Without this the Scan
// page loses everything on unmount.
import type { Listing, EvaluationResult } from './scannerApi';

export interface RowState {
  busy: boolean;
  result: EvaluationResult | null;
  error: string | null;
}

export interface ScanState {
  keyword: string;
  country: string;
  city: string;
  listings: Listing[];
  rows: Record<string, RowState>;
  selected: string | null;
  hasScanned: boolean;
}

const KEY = 'j4u-scan-state';

/** Reset transient busy flags — a restored session should never look mid-evaluation. */
export function clearBusy(rows: Record<string, RowState>): Record<string, RowState> {
  const out: Record<string, RowState> = {};
  for (const [k, v] of Object.entries(rows)) out[k] = { ...v, busy: false };
  return out;
}

export function defaultScanState(country: string): ScanState {
  return { keyword: '', country, city: '', listings: [], rows: {}, selected: null, hasScanned: false };
}

export function loadScanState(fallback: ScanState): ScanState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ScanState>;
    return {
      ...fallback,
      ...parsed,
      rows: clearBusy((parsed.rows ?? {}) as Record<string, RowState>),
    };
  } catch {
    return fallback;
  }
}

export function saveScanState(state: ScanState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, rows: clearBusy(state.rows) }));
  } catch {
    /* storage unavailable — non-fatal */
  }
}
