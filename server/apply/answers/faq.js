import { getJson, setJson } from '../../storage/kv.js';

// Per-user FAQ store: user-authored Q&A pairs used to GROUND high-confidence
// auto-apply answers. These are the canonical "known answers" alongside profile
// fields. Local-only via the kv adapter (filesystem locally, Postgres on cloud).

export const EMPTY_FAQ = { items: [] };

function normalize(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    items: items
      .map((f, i) => {
        const question = String(f?.question ?? '').trim();
        const answer = String(f?.answer ?? '').trim();
        if (!answer) return null;
        return {
          id: f?.id ?? `faq_${i}`,
          question,
          answer,
          updatedAt: f?.updatedAt ?? new Date().toISOString(),
        };
      })
      .filter(Boolean),
  };
}

export async function loadFaq(userId) {
  const raw = await getJson(userId, 'faq');
  return normalize(raw);
}

export async function saveFaq(userId, items) {
  const next = normalize({ items });
  return setJson(userId, 'faq', next);
}

export async function addFaq(userId, { question, answer }) {
  const current = await loadFaq(userId);
  const q = String(question ?? '').trim();
  const a = String(answer ?? '').trim();
  if (!a) return current;
  const id = `faq_${Date.now()}`;
  current.items.push({ id, question: q, answer: a, updatedAt: new Date().toISOString() });
  return setJson(userId, 'faq', current);
}
