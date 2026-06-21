export function createByoKeyEngine({
  baseUrl = 'https://api.openai.com/v1',
  apiKey = '',
  model = 'gpt-4o-mini',
} = {}) {
  async function generate({ system, prompt }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async function testConnection() {
    if (!apiKey) return { ok: false, message: 'No API key provided.' };
    try {
      await generate({ prompt: 'Reply with the single word: OK' });
      return { ok: true, message: `Connected to ${model}.` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return { name: 'byok', testConnection, generate };
}
