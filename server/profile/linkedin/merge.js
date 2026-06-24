import { normalizeProfile } from '../schema.js';

// Merges an incoming (LinkedIn-derived) profile into the user's existing profile.
// Rules: fill blank scalars only (never overwrite user edits); append array items
// only when new (keyed, case-insensitive); report what changed for the review UI.
// Pure: does not mutate inputs, does not persist.

const SCALARS = ['fullName', 'email', 'phone', 'location', 'headline', 'summary'];

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Keying + a human label per array section, for dedupe and the change summary.
const ARRAY_SPECS = {
  experience: { key: (e) => `${norm(e.company)}|${norm(e.title)}|${norm(e.startDate)}`, label: (e) => `${e.title} — ${e.company}` },
  education: { key: (e) => `${norm(e.institution)}|${norm(e.degree)}|${norm(e.field)}`, label: (e) => `${e.degree} — ${e.institution}` },
  certifications: { key: (e) => `${norm(e.name)}|${norm(e.issuer)}`, label: (e) => e.name },
  languages: { key: (e) => norm(e.name), label: (e) => e.name },
  awards: { key: (e) => `${norm(e.title)}|${norm(e.issuer)}`, label: (e) => e.title },
  projects: { key: (e) => norm(e.name), label: (e) => e.name },
};

export function mergeProfile(existing, incoming) {
  const base = normalizeProfile(existing);
  const next = normalizeProfile(incoming);
  const merged = normalizeProfile(JSON.parse(JSON.stringify(base)));
  const changes = { filled: [], added: {}, addedItems: {} };

  for (const field of SCALARS) {
    if (!String(base[field] ?? '').trim() && String(next[field] ?? '').trim()) {
      merged[field] = next[field];
      changes.filled.push(field);
    }
  }

  for (const [field, spec] of Object.entries(ARRAY_SPECS)) {
    const seen = new Set(base[field].map(spec.key));
    const fresh = [];
    for (const item of next[field]) {
      const k = spec.key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(item);
    }
    if (fresh.length) {
      merged[field] = [...base[field], ...fresh];
      changes.added[field] = fresh.length;
      changes.addedItems[field] = fresh.map(spec.label);
    }
  }

  // skills + links are plain string arrays — dedupe case-insensitively.
  for (const field of ['skills', 'links']) {
    const seen = new Set(base[field].map(norm));
    const fresh = next[field].filter((s) => s && !seen.has(norm(s)) && seen.add(norm(s)));
    if (fresh.length) {
      merged[field] = [...base[field], ...fresh];
      changes.added[field] = fresh.length;
      changes.addedItems[field] = fresh;
    }
  }

  return { merged, changes };
}
