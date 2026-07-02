const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiEngine({ apiKey = '', model = 'gemini-2.0-flash' } = {}) {
  async function call(body) {
    const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  async function generate({ system, prompt }) {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return call(body);
  }

  // Multimodal: the prompt text plus one inline_data part per screenshot.
  async function generateVision({ system, prompt, images = [] }) {
    const parts = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType || 'image/png', data: img.base64 } });
    }
    const body = { contents: [{ parts }] };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return call(body);
  }

  async function testConnection() {
    if (!apiKey) return { ok: false, message: 'No Gemini API key provided.' };
    try {
      await generate({ prompt: 'Reply with the single word: OK' });
      return { ok: true, message: `Connected to Gemini (${model}).` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return { name: 'gemini', testConnection, generate, generateVision };
}
