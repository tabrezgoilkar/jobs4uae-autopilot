export function createOllamaEngine({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'llama3.2',
} = {}) {
  baseUrl = baseUrl.replace(/\/+$/, '');
  async function generate({ system, prompt }) {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, system, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.response ?? '';
  }

  async function testConnection() {
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const names = (data?.models ?? []).map((m) => m.name);
      const installed = names.some((n) => n === model || n.startsWith(model + ':'));
      return installed
        ? { ok: true, message: `Ollama running; model "${model}" is installed.` }
        : { ok: false, message: `Ollama is running but model "${model}" is not installed yet.` };
    } catch {
      return { ok: false, message: `Could not reach Ollama at ${baseUrl}. Is it installed and running?` };
    }
  }

  return { name: 'ollama', testConnection, generate };
}
