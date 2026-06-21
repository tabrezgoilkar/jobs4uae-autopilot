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
