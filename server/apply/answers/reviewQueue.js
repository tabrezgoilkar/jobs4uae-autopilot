import { getJson, setJson } from '../../storage/kv.js';

// Per-user "Needs review" queue for low-confidence auto-apply answers. When a
// graded answer cannot be grounded in any profile/FAQ field (confidence 'low'),
// it is NOT submitted — it lands here for the human to confirm or edit.
// Local-only via the kv adapter (filesystem locally, Postgres on cloud).

export const EMPTY_QUEUE = { items: [] };

function normalize(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    items: items
      .map((it) => ({
        id: String(it?.id ?? ''),
        label: String(it?.label ?? ''),
        answer: String(it?.answer ?? ''),
        confidence: it?.confidence === 'high' ? 'high' : 'low',
        missingReference: String(it?.missingReference ?? 'profile/FAQ'),
        jobUrl: String(it?.jobUrl ?? ''),
        createdAt: it?.createdAt ?? new Date().toISOString(),
      }))
      .filter((it) => it.id && it.label && it.answer),
  };
}

export async function loadQueue(userId) {
  const raw = await getJson(userId, 'review-queue');
  return normalize(raw);
}

export async function enqueueReview(userId, entries = [], jobUrl = '') {
  const current = await loadQueue(userId);
  for (const e of entries ?? []) {
    if (!e?.id || !e?.label || !e?.answer) continue;
    current.items.push({
      id: e.id,
      label: e.label,
      answer: e.answer,
      confidence: 'low',
      missingReference: e.missingReference ?? 'profile/FAQ',
      jobUrl: jobUrl ?? '',
      createdAt: new Date().toISOString(),
    });
  }
  return setJson(userId, 'review-queue', current);
}

export async function resolveReview(userId, id, { answer } = {}) {
  const current = await loadQueue(userId);
  const idx = current.items.findIndex((it) => it.id === id);
  if (idx === -1) return current;
  if (answer !== undefined) current.items[idx].answer = String(answer);
  current.items.splice(idx, 1); // resolved → removed from the queue
  return setJson(userId, 'review-queue', current);
}

export async function clearQueue(userId) {
  return setJson(userId, 'review-queue', { items: [] });
}
