export type EngineId = 'gemini' | 'byok' | 'ollama';

export interface AppConfig {
  engine: EngineId | null;
  gemini: { apiKey: string; model: string };
  byok: { baseUrl: string; apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
  setupComplete: boolean;
}

async function checkOk(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`Server error ${res.status}`);
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
  jobTitle: string;
  company: string;
  evaluationId: string | null;
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
