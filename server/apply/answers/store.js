import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir } from '../../config/paths.js';

// Application Details: the standard GCC answers a user re-enters on every job
// form, plus an accumulating Q&A memory so a screening question is asked once
// and reused forever after. Local-only (data/application-details.json).

export const EMPTY_DETAILS = {
  fields: {
    nationality: '',
    visaStatus: '',
    noticePeriod: '',
    currentSalary: '',
    expectedSalary: '',
    willingToRelocate: '',
    drivingLicence: '',
    languages: [],
  },
  memory: [],
};

function detailsPath() {
  return path.join(dataDir(), 'application-details.json');
}

/** Lowercase, strip punctuation, collapse whitespace — the key memory is matched on. */
export function normalizeKey(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDetails(raw = {}) {
  const fields = { ...EMPTY_DETAILS.fields, ...(raw.fields ?? {}) };
  fields.languages = Array.isArray(fields.languages) ? fields.languages : [];
  const memory = Array.isArray(raw.memory) ? raw.memory : [];
  return { fields, memory };
}

export function loadDetails() {
  const p = detailsPath();
  if (!fs.existsSync(p)) return structuredClone(EMPTY_DETAILS);
  try {
    return normalizeDetails(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return structuredClone(EMPTY_DETAILS);
  }
}

function write(details) {
  const p = detailsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(details, null, 2));
  return details;
}

/** Merge a partial { fields } patch; never touches memory. */
export function saveDetails(patch = {}) {
  const current = loadDetails();
  const next = normalizeDetails({
    fields: { ...current.fields, ...(patch.fields ?? {}) },
    memory: current.memory,
  });
  return write(next);
}

/**
 * Upsert a remembered answer by normalized question. Same logical question keeps
 * its id and updates the answer + timestamp. Blank label/answer is a no-op (null).
 */
export function rememberAnswer({ questionLabel, answer, source = 'user' }) {
  const label = String(questionLabel ?? '').trim();
  const value = String(answer ?? '').trim();
  if (!label || !value) return null;

  const key = normalizeKey(label);
  const details = loadDetails();
  const now = new Date().toISOString();
  const existing = details.memory.find((m) => m.normalizedKey === key);

  let entry;
  if (existing) {
    existing.questionLabel = label;
    existing.answer = value;
    existing.source = source;
    existing.updatedAt = now;
    entry = existing;
  } else {
    entry = { id: randomUUID(), questionLabel: label, normalizedKey: key, answer: value, source, updatedAt: now };
    details.memory.push(entry);
  }
  write(details);
  return entry;
}

/** Exact stored answer for a question label (normalized), or undefined. */
export function findAnswer(questionLabel) {
  const key = normalizeKey(questionLabel);
  if (!key) return undefined;
  return loadDetails().memory.find((m) => m.normalizedKey === key);
}
