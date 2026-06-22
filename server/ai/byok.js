// Remembers, per base URL, the last free model that actually worked — so after
// one discovery we don't re-probe a dead model on every request.
const goodModelByBase = new Map();

/**
 * OpenAI-compatible "bring your own key" engine.
 *
 * For OpenRouter (or when `model` is "auto"/empty), it auto-discovers a working
 * FREE model and rotates to the next one whenever the chosen model is gone or
 * rate-limited (404/400/429) — so a retired `:free` model self-heals instead of
 * hard-failing. For other providers (OpenAI, etc.) it uses the configured model
 * as-is.
 */
export function createByoKeyEngine({
  baseUrl = 'https://api.openai.com/v1',
  apiKey = '',
  model = 'gpt-4o-mini',
} = {}) {
  baseUrl = baseUrl.replace(/\/+$/, '');
  const isOpenRouter = /openrouter\.ai/i.test(baseUrl);
  const wantsAuto = !model || model === 'auto';
  const canRotate = isOpenRouter || wantsAuto;

  let freeModelsCache = null;

  async function fetchFreeModels() {
    if (freeModelsCache) return freeModelsCache;
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`Could not list models (${res.status}).`);
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    freeModelsCache = list
      .filter((m) => {
        const id = m?.id ?? '';
        const p = m?.pricing ?? {};
        return id.endsWith(':free') || (Number(p.prompt) === 0 && Number(p.completion) === 0);
      })
      .map((m) => m.id);
    return freeModelsCache;
  }

  // Ordered, de-duplicated list of models to try, skipping ones already failed.
  async function candidates(tried) {
    const out = [];
    const add = (m) => { if (m && !tried.has(m) && !out.includes(m)) out.push(m); };
    add(goodModelByBase.get(baseUrl));     // last known-good first
    if (!wantsAuto) add(model);            // then the user's configured model
    if (canRotate) {
      const free = await fetchFreeModels().catch(() => []);
      free.forEach(add);                   // then any currently-free model
    }
    return out;
  }

  function isModelError(status) {
    return status === 404 || status === 400 || status === 429;
  }

  async function callModel(m, messages) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: m, messages }),
    });
    if (!res.ok) {
      const err = new Error(`API error ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async function generate({ system, prompt }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    // Fixed-model providers (e.g. OpenAI): one shot, no discovery.
    if (!canRotate) return callModel(model, messages);

    const tried = new Set();
    let lastErr;
    for (let i = 0; i < 8; i++) {
      const list = await candidates(tried);
      const next = list[0];
      if (!next) break;
      try {
        const out = await callModel(next, messages);
        goodModelByBase.set(baseUrl, next); // remember what worked
        return out;
      } catch (e) {
        lastErr = e;
        tried.add(next);
        if (goodModelByBase.get(baseUrl) === next) goodModelByBase.delete(baseUrl);
        if (isModelError(e.status)) continue; // model gone / rate-limited → rotate
        throw e; // network/auth error — rotating won't help
      }
    }
    throw lastErr ?? new Error('No working free model is available right now. Please try again later.');
  }

  async function testConnection() {
    if (!apiKey) return { ok: false, message: 'No API key provided.' };
    try {
      await generate({ prompt: 'Reply with the single word: OK' });
      const used = goodModelByBase.get(baseUrl) || model;
      return { ok: true, message: canRotate ? `Connected — using free model ${used}.` : `Connected to ${model}.` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return { name: 'byok', testConnection, generate };
}
