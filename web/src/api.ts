export type EngineId = 'gemini' | 'openrouter' | 'byok' | 'ollama';

export interface ApplicationDetails {
  nationality?: string;
  visaStatus?: string;
  noticePeriod?: string;
  expectedSalary?: string;
}

export interface AppConfig {
  engine: EngineId | null;
  gemini: { apiKey: string; model: string };
  openrouter: { apiKey: string; model: string };
  byok: { baseUrl: string; apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
  applicationDetails?: ApplicationDetails;
  setupComplete: boolean;
}

// --- Auth: attach the Clerk session token to /api requests ---
// The token getter is registered by the Clerk provider (see main.tsx). When it's
// unset (local dev without Clerk), requests go out unauthenticated and the server
// runs in its 'local' dev-bypass mode — so nothing here changes local behaviour.
type TokenGetter = () => Promise<string | null>;
let authTokenGetter: TokenGetter | null = null;
export function setAuthTokenGetter(getter: TokenGetter | null): void {
  authTokenGetter = getter;
}

declare global {
  interface Window { __j4uFetchPatched?: boolean }
}

if (typeof window !== 'undefined' && !window.__j4uFetchPatched) {
  window.__j4uFetchPatched = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (authTokenGetter && url.startsWith('/api')) {
      try {
        const token = await authTokenGetter();
        if (token) init = { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } };
      } catch {
        // fall through unauthenticated; the server will 401 and the UI reacts
      }
    }
    return realFetch(input, init);
  };
}

// Carries the HTTP status so callers can distinguish an auth failure (401 — the
// session is missing/expired/unauthorized) from a real server/network problem.
export class ApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`Server error ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function checkOk(res: Response): Promise<Response> {
  if (!res.ok) throw new ApiError(res.status);
  return res;
}

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config').then(checkOk);
  return res.json();
}

export async function saveConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(partial),
  }).then(checkOk);
  return res.json();
}

export async function testAI(body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/ai/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ ok: false, message: `Server error ${res.status}` }));
}

export interface Experience { company: string; title: string; startDate: string; endDate: string; description: string; }
export interface Education { institution: string; degree: string; field: string; year: string; }
export interface Project { name: string; description: string; tech: string[]; url: string; }
export interface Certification { name: string; issuer: string; year: string; url: string; }
export interface Language { name: string; level: string; }
export interface Award { title: string; issuer: string; year: string; description: string; }
export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  awards: Award[];
  links: string[];
  updatedAt: string | null;
}

export async function getProfile(): Promise<Profile> {
  const res = await fetch('/api/profile').then(checkOk);
  return res.json();
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
  }).then(checkOk);
  return res.json();
}

export async function importCv(file: File): Promise<Profile> {
  const fd = new FormData();
  fd.append('cv', file);
  const res = await fetch('/api/profile/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export interface LinkedinChanges {
  filled: string[];
  added: Record<string, number>;
  addedItems: Record<string, string[]>;
}
export interface LinkedinImportResult { merged: Profile; changes: LinkedinChanges; partial?: boolean; }

async function readImport(res: Response): Promise<LinkedinImportResult> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function getLinkedinBookmarklet(): Promise<{ href: string }> {
  const res = await fetch('/api/profile/linkedin/bookmarklet').then(checkOk);
  return res.json();
}

export async function importLinkedinFile(file: File): Promise<LinkedinImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  return readImport(await fetch('/api/profile/linkedin/import', { method: 'POST', body: fd }));
}

export async function importLinkedinJson(raw: unknown): Promise<LinkedinImportResult> {
  return readImport(await fetch('/api/profile/linkedin/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(raw),
  }));
}

/** Polls for a bookmarklet import the user triggered in their LinkedIn tab (take-once). */
export async function getPendingLinkedin(): Promise<LinkedinImportResult | null> {
  const res = await fetch('/api/profile/linkedin/pending').then(checkOk);
  return (await res.json()).pending;
}

/** Carries the server's `reason` (e.g. 'blocked') so the UI can offer a fallback. */
export class LinkedinImportError extends Error {
  reason?: string;
  offerBookmarklet?: boolean;
  offerScreenshots?: boolean;
  constructor(message: string, reason?: string, flags: { offerBookmarklet?: boolean; offerScreenshots?: boolean } = {}) {
    super(message);
    this.name = 'LinkedinImportError';
    this.reason = reason;
    this.offerBookmarklet = flags.offerBookmarklet;
    this.offerScreenshots = flags.offerScreenshots;
  }
}

/** Cheap client-side guard so the Import button only enables on a plausible profile URL. */
export function isLikelyProfileUrl(url: string): boolean {
  return /^https?:\/\/([a-z]+\.)?linkedin\.com\/in\/[^/]+\/?/i.test(url.trim());
}

/** Paste-a-URL prefill (basics). Throws LinkedinImportError with reason 'blocked' on the cloud. */
export async function importLinkedinUrl(url: string): Promise<LinkedinImportResult> {
  const res = await fetch('/api/profile/linkedin/url', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new LinkedinImportError(b.error || `Server error ${res.status}`, b.reason, {
      offerBookmarklet: b.offerBookmarklet,
      offerScreenshots: b.offerScreenshots,
    });
  }
  return res.json();
}

/** Screenshot import — reads 1+ profile screenshots with a vision model (works on cloud). */
export async function importLinkedinScreenshots(files: File[]): Promise<LinkedinImportResult> {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  return readImport(await fetch('/api/profile/linkedin/vision', { method: 'POST', body: fd }));
}

export interface BaselineResult { profile: Profile; baselineMarkdown: string; summaryGenerated: boolean; }
/** After import: fill a blank summary (AI, anti-fabrication) + render a base CV. */
export async function buildBaseline(profile: Profile): Promise<BaselineResult> {
  const res = await fetch('/api/profile/baseline', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }),
  }).then(checkOk);
  return res.json();
}

export interface AssistResult { reply: string; questions: string[]; proposed: Profile | null; }
export async function assistProfile(message: string): Promise<AssistResult> {
  const res = await fetch('/api/profile/assist', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(b.error || `Server error ${res.status}`);
  }
  return res.json();
}

// --- Assisted Auto-Apply (Phase 11) ---
export interface Connection { id: string; name: string; connected: boolean; updatedAt: string | null; }
export interface ApplicationFields {
  nationality: string; visaStatus: string; noticePeriod: string;
  currentSalary: string; expectedSalary: string; willingToRelocate: string;
  drivingLicence: string; languages: string[];
}
export interface RememberedAnswer { id: string; questionLabel: string; answer: string; source: string; updatedAt: string; }
export interface ApplicationDetailsData { fields: ApplicationFields; memory: RememberedAnswer[]; }
export interface PendingQuestion { id: string; selector: string; label: string; type: string; draft?: string; }
export interface ApplyStartResult { filledCount: number; pending: PendingQuestion[]; }

export async function getConnections(): Promise<Connection[]> {
  return (await fetch('/api/connections').then(checkOk)).json();
}
export async function connectBoard(board: string): Promise<{ ok: boolean }> {
  return (await fetch(`/api/connections/${board}/connect`, { method: 'POST' }).then(checkOk)).json();
}
export async function confirmBoard(board: string): Promise<Connection[]> {
  return (await fetch(`/api/connections/${board}/confirm`, { method: 'POST' }).then(checkOk)).json();
}
export async function disconnectBoard(board: string): Promise<Connection[]> {
  return (await fetch(`/api/connections/${board}/disconnect`, { method: 'POST' }).then(checkOk)).json();
}

export async function getApplicationDetails(): Promise<ApplicationDetailsData> {
  return (await fetch('/api/application-details').then(checkOk)).json();
}
export async function saveApplicationDetails(fields: Partial<ApplicationFields>): Promise<ApplicationDetailsData> {
  return (await fetch('/api/application-details', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields }),
  }).then(checkOk)).json();
}

async function readApply<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}
export async function applyStart(body: { board: string; jobUrl: string; documentId?: string }): Promise<ApplyStartResult> {
  return readApply(await fetch('/api/apply/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
}
export async function applyAnswer(body: { board: string; answers: { id: string; answer: string }[] }): Promise<{ remaining: PendingQuestion[] }> {
  return readApply(await fetch('/api/apply/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
}

export interface EmailDraft { to: string; subject: string; body: string; mailto: string; gmail: string; foundEmails: string[]; }
export async function composeEmail(body: { jobText: string; recruiterEmail?: string; company?: string }): Promise<EmailDraft> {
  return readApply(await fetch('/api/apply/email/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
}

export interface Dimension { name: string; score: string; comment: string; }
export interface Evaluation {
  id: string;
  createdAt: string;
  jobTitle: string;
  company: string;
  location: string;
  grade: string;
  recommendation: 'apply' | 'maybe' | 'skip';
  summary: string;
  dimensions: Dimension[];
  matchedSkills: string[];
  missingSkills: string[];
}

export async function runEvaluation(jobText: string): Promise<Evaluation> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobText }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function listEvaluations(): Promise<Evaluation[]> {
  const res = await fetch('/api/evaluations').then(checkOk);
  return res.json();
}

export interface DocumentDraft {
  resumeMarkdown: string;
  coverLetterMarkdown: string;
  /** Deterministic CV rendered from the profile (the "before tailoring" baseline). */
  baseResumeMarkdown?: string;
  /** Career-coach reasoning: the key tailoring decisions and why. */
  rationale?: string;
  jobTitle: string;
  company: string;
  evaluationId: string | null;
  fitScore: string;
  missingSkills: string[];
}
export interface DocumentRecord extends DocumentDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function generateDocuments(body: {
  jobText?: string;
  jobTitle?: string;
  company?: string;
  evaluationId?: string | null;
}): Promise<DocumentDraft> {
  const res = await fetch('/api/documents/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(e.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch('/api/documents').then(checkOk);
  return res.json();
}

export async function saveDocument(doc: Partial<DocumentRecord>): Promise<DocumentRecord> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(e.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(e.error || `Server error ${res.status}`);
  }
  return res.json();
}
