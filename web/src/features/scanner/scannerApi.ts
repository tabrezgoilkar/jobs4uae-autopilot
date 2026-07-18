export interface Listing {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  salary?: string;
  posted?: string;
}

export interface Board {
  id: string;
  name: string;
  status?: 'experimental' | 'verified' | 'production';
}

export interface ScanResult {
  listings: Listing[];
  error?: string;
}

export interface EvalDimension {
  name: string;
  score: string;
  comment: string;
}

export interface EvaluationResult {
  id: string;
  grade: string;
  recommendation: 'apply' | 'maybe' | 'skip' | string;
  summary: string;
  dimensions: EvalDimension[];
  matchedSkills: string[];
  missingSkills: string[];
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

export interface SalaryEstimate {
  low: number | null;
  high: number | null;
  currency: string;
  period: 'month' | 'year';
  note: string;
}

/** AI-estimated GCC salary range for a role (clearly an estimate). */
export async function estimateSalary(body: { title: string; country?: string; city?: string }): Promise<SalaryEstimate> {
  const res = await fetch('/api/scanner/salary', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return apiJson<SalaryEstimate>(res);
}

/** Fetch a job posting from a pasted URL (server opens it in a headed browser). */
export async function fetchJobFromUrl(url: string): Promise<{ jobText: string; source: string }> {
  const res = await fetch('/api/scanner/fetch-job', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return apiJson<{ jobText: string; source: string }>(res);
}

/** Evaluate raw job-description text. Used by both listing and manual-paste flows. */
export async function evaluateJobText(jobText: string): Promise<EvaluationResult> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobText }),
  });
  return apiJson<EvaluationResult>(res);
}

export interface ResumeOptimization {
  content_suggestions: { section: string; before: string; after: string; rationale: string }[];
  skills_to_highlight: string[];
  achievements_to_add: string[];
  keywords_for_ats: string[];
  formatting_suggestions: string[];
}

/** CrewAI-style structured CV optimization (before/after per section). Cloud-safe. */
export async function optimizeResume(jobText: string): Promise<ResumeOptimization> {
  const res = await fetch('/api/scanner/optimize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobText }),
  });
  return apiJson<ResumeOptimization>(res);
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

  return evaluateJobText(jobText);
}
