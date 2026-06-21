export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface Application {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  notes: string;
  evaluationId: string | null;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function apiJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
  if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);
  return body as T;
}

export async function listApplications(): Promise<Application[]> {
  const res = await fetch('/api/applications');
  return apiJson<Application[]>(res);
}

export async function createApplication(
  data: Partial<Omit<Application, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Application> {
  const res = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  return apiJson<Application>(res);
}

export async function updateApplication(
  id: string,
  patch: Partial<Omit<Application, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Application> {
  const res = await fetch(`/api/applications/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return apiJson<Application>(res);
}

export async function deleteApplication(id: string): Promise<void> {
  const res = await fetch(`/api/applications/${id}/delete`, { method: 'POST' });
  await apiJson<{ ok: boolean }>(res);
}
