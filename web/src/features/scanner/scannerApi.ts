export interface Listing {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
}

export interface Board {
  id: string;
  name: string;
}

export interface ScanResult {
  listings: Listing[];
  error?: string;
}

export interface EvaluationResult {
  id: string;
  grade: string;
  recommendation: string;
  summary: string;
  [key: string]: unknown;
}

async function apiJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Server error ${res.status}`);
  return body as T;
}

/** List all supported job boards. */
export async function listBoards(): Promise<Board[]> {
  const res = await fetch('/api/scanner/boards');
  return apiJson<Board[]>(res);
}

/** Scan a job board for listings. Returns {listings, error?}. */
export async function scan({
  board,
  keyword,
  country,
  city,
}: {
  board: string;
  keyword: string;
  country: string;
  city?: string;
}): Promise<ScanResult> {
  const res = await fetch('/api/scanner/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ board, keyword, country, city }),
  });
  // 4xx errors are returned as JSON {error}; 200 always has listings
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    return { listings: [], error: (body as { error?: string }).error || `Server error ${res.status}` };
  }
  return apiJson<ScanResult>(res);
}

/**
 * Evaluate a listing by composing job text from listing fields
 * and posting to /api/evaluate.
 * Does NOT import shared api.ts — calls fetch directly.
 */
export async function evaluateListing(listing: Listing): Promise<EvaluationResult> {
  const jobText = [
    listing.title && `Job Title: ${listing.title}`,
    listing.company && `Company: ${listing.company}`,
    listing.location && `Location: ${listing.location}`,
    listing.url && `URL: ${listing.url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobText }),
  });
  return apiJson<EvaluationResult>(res);
}
