import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

function storePath() {
  return path.join(dataDir(), 'evaluations.json');
}

export function listEvaluations() {
  const p = storePath();
  if (!fs.existsSync(p)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2));
}

function newId() {
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addEvaluation(evaluation) {
  const record = { ...evaluation, id: newId(), createdAt: new Date().toISOString() };
  const list = listEvaluations();
  list.unshift(record); // newest first
  writeAll(list);
  return record;
}

export function getEvaluation(id) {
  return listEvaluations().find((e) => e.id === id) ?? null;
}
