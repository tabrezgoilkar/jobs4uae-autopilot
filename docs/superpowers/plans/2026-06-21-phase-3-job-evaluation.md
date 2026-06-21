# Phase 3 — Job Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user paste a job description and get a clear **A–F fit score** (overall + per-dimension), plain-language reasons, matched/missing skills, and an **apply / maybe / skip** recommendation — evaluated against their saved profile, with each evaluation saved locally and listed.

**Architecture:** A shared JSON-extraction util (factored out of the existing profile parser) feeds a new `server/evaluate/` module (prompt builder + `evaluateJob`). A JSON-file store (`data/evaluations.json`) persists results. New routes under `/api/evaluate` (run) and `/api/evaluations` (list/get). The front-end gains an Evaluate page (paste JD → graded result card) and a recent-evaluations list, plus a nav entry.

**Tech Stack:** Existing Node/Express + AI adapter + JSON-file stores; React + Vite + Tailwind + react-router (all already in place). Tests: Vitest + Supertest with mocked AI/fetch. GCC-aware rubric (includes location/relocation fit).

---

## File Structure

```
server/
  lib/
    json.js              # extractJson() — shared, factored out of profile/parse.js
  evaluate/
    prompt.js            # buildEvaluationPrompt(profile, jobText) + EVAL_SYSTEM
    engine.js            # evaluateJob(profile, jobText, engine) -> structured result
    store.js             # listEvaluations() / addEvaluation() / getEvaluation(id)
  profile/
    parse.js             # MODIFY: import extractJson from ../lib/json.js (re-export for back-compat)
  routes/
    evaluate.routes.js   # POST /api/evaluate ; GET /api/evaluations ; GET /api/evaluations/:id
  app.js                 # MODIFY: mount evaluateRouter
  __tests__/
    lib-json.test.js
    evaluate-store.test.js
    evaluate-engine.test.js
    api-evaluate.test.js
web/
  src/
    api.ts               # MODIFY: Evaluation types + runEvaluation/listEvaluations
    App.tsx              # MODIFY: add /evaluate route
    components/Layout.tsx # MODIFY: add "Evaluate Jobs" nav link
    pages/EvaluatePage.tsx# paste JD -> graded result card + recent list
    pages/Dashboard.tsx   # MODIFY: add CTA to Evaluate
```

---

## Task 1: Shared JSON-extraction util (DRY refactor of the profile parser)

**Files:**
- Create: `server/lib/json.js`
- Modify: `server/profile/parse.js`
- Test: `server/__tests__/lib-json.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/lib-json.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractJson } from '../lib/json.js';

describe('extractJson (shared)', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}').a).toBe(1);
  });
  it('parses JSON inside a code fence', () => {
    expect(extractJson('```json\n{"a":2}\n```').a).toBe(2);
  });
  it('parses JSON with surrounding prose', () => {
    expect(extractJson('result:\n{"a":3}\ndone').a).toBe(3);
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('nope')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/lib-json.test.js`
Expected: FAIL — cannot find `../lib/json.js`.

- [ ] **Step 3: Create the shared util**

`server/lib/json.js`:
```js
export function extractJson(text) {
  if (!text) throw new Error('Empty AI response.');
  let t = String(text).trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI did not return JSON.');
  return JSON.parse(t.slice(start, end + 1));
}
```

- [ ] **Step 4: Refactor `server/profile/parse.js` to use it**

Replace the local `extractJson` definition with a re-export so existing imports keep working. The new top of `server/profile/parse.js`:
```js
import { extractJson } from '../lib/json.js';

export { extractJson };
```
Delete the old inline `export function extractJson(text) { ... }` body from `parse.js`. Leave `SYSTEM`, `buildPrompt`, and `parseCvText` unchanged (they call `extractJson`, now imported).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — `lib-json` passes and ALL existing tests (incl. `profile-parse.test.js`) still pass.

- [ ] **Step 6: Commit**

```bash
git add server/lib/json.js server/profile/parse.js server/__tests__/lib-json.test.js
git commit -m "refactor: extract shared extractJson util"
```

---

## Task 2: Evaluations store (JSON file)

**Files:**
- Create: `server/evaluate/store.js`
- Test: `server/__tests__/evaluate-store.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/evaluate-store.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('evaluations store', () => {
  it('starts empty', async () => {
    const { listEvaluations } = await import('../evaluate/store.js');
    expect(listEvaluations()).toEqual([]);
  });

  it('adds an evaluation with an id and createdAt, newest first', async () => {
    const { addEvaluation, listEvaluations } = await import('../evaluate/store.js');
    const a = addEvaluation({ jobTitle: 'A', grade: 'B' });
    const b = addEvaluation({ jobTitle: 'B', grade: 'A' });
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    const list = listEvaluations();
    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe('B'); // newest first
  });

  it('gets an evaluation by id', async () => {
    const { addEvaluation, getEvaluation } = await import('../evaluate/store.js');
    const a = addEvaluation({ jobTitle: 'X', grade: 'C' });
    expect(getEvaluation(a.id).jobTitle).toBe('X');
    expect(getEvaluation('missing')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/evaluate-store.test.js`
Expected: FAIL — cannot find `../evaluate/store.js`.

- [ ] **Step 3: Implement**

`server/evaluate/store.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/evaluate-store.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add server/evaluate/store.js server/__tests__/evaluate-store.test.js
git commit -m "feat: add evaluations JSON store"
```

---

## Task 3: Evaluation engine (prompt + parse)

**Files:**
- Create: `server/evaluate/prompt.js`, `server/evaluate/engine.js`
- Test: `server/__tests__/evaluate-engine.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/evaluate-engine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { evaluateJob } from '../evaluate/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'], experience: [], education: [] };

describe('evaluateJob', () => {
  it('returns a normalized evaluation from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({
        jobTitle: 'Senior Accountant',
        company: 'ACME',
        location: 'Dubai',
        grade: 'B',
        recommendation: 'apply',
        summary: 'Good fit overall.',
        dimensions: [{ name: 'Skills match', score: 'B', comment: 'Strong Excel.' }],
        matchedSkills: ['Excel'],
        missingSkills: ['SAP'],
      }),
    };
    const result = await evaluateJob(PROFILE, 'Senior Accountant at ACME in Dubai', engine);
    expect(result.grade).toBe('B');
    expect(result.recommendation).toBe('apply');
    expect(result.dimensions[0].name).toBe('Skills match');
    expect(result.matchedSkills).toEqual(['Excel']);
  });

  it('normalizes a bad/partial response into safe defaults', async () => {
    const engine = { generate: async () => '{"grade":"Z","summary":"x"}' };
    const result = await evaluateJob(PROFILE, 'some job', engine);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade); // invalid 'Z' coerced
    expect(Array.isArray(result.dimensions)).toBe(true);
    expect(Array.isArray(result.matchedSkills)).toBe(true);
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'sorry, no' };
    await expect(evaluateJob(PROFILE, 'job', engine)).rejects.toThrow(/Could not understand/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/evaluate-engine.test.js`
Expected: FAIL — cannot find `../evaluate/engine.js`.

- [ ] **Step 3: Implement the prompt**

`server/evaluate/prompt.js`:
```js
export const EVAL_SYSTEM =
  'You are a careful job-fit evaluator for candidates job-hunting in the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). Return ONLY valid JSON, no commentary.';

export const DIMENSIONS = [
  'Skills match',
  'Experience level',
  'Industry / domain fit',
  'Seniority match',
  'Location / relocation fit (GCC)',
  'Growth potential',
];

export function buildEvaluationPrompt(profile, jobText) {
  return `Evaluate how well this candidate fits the job below. Be honest and specific; do not invent facts.

Grade the OVERALL fit and EACH dimension on an A–F scale (A = excellent fit, F = poor fit).
Recommendation must be one of: "apply", "maybe", "skip".

Score these dimensions (use exactly these names): ${DIMENSIONS.map((d) => `"${d}"`).join(', ')}.

Return JSON with EXACTLY these keys:
{
  "jobTitle": string,
  "company": string,
  "location": string,
  "grade": "A" | "B" | "C" | "D" | "F",
  "recommendation": "apply" | "maybe" | "skip",
  "summary": string,                 // 2-4 sentences in plain language
  "dimensions": [ { "name": string, "score": "A"|"B"|"C"|"D"|"F", "comment": string } ],
  "matchedSkills": string[],         // candidate skills relevant to this job
  "missingSkills": string[]          // important skills the job wants that the candidate lacks
}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
```

- [ ] **Step 4: Implement the engine**

`server/evaluate/engine.js`:
```js
import { extractJson } from '../lib/json.js';
import { EVAL_SYSTEM, buildEvaluationPrompt } from './prompt.js';

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const RECS = ['apply', 'maybe', 'skip'];

function coerceGrade(g) {
  const up = String(g || '').trim().toUpperCase();
  return GRADES.includes(up) ? up : 'C';
}

function normalizeEvaluation(raw = {}) {
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.map((d) => ({
        name: String(d?.name ?? ''),
        score: coerceGrade(d?.score),
        comment: String(d?.comment ?? ''),
      }))
    : [];
  return {
    jobTitle: String(raw.jobTitle ?? ''),
    company: String(raw.company ?? ''),
    location: String(raw.location ?? ''),
    grade: coerceGrade(raw.grade),
    recommendation: RECS.includes(raw.recommendation) ? raw.recommendation : 'maybe',
    summary: String(raw.summary ?? ''),
    dimensions,
    matchedSkills: Array.isArray(raw.matchedSkills) ? raw.matchedSkills.map(String) : [],
    missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills.map(String) : [],
  };
}

export async function evaluateJob(profile, jobText, engine) {
  const raw = await engine.generate({
    system: EVAL_SYSTEM,
    prompt: buildEvaluationPrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while evaluating this job. ${e.message}`);
  }
  return normalizeEvaluation(parsed);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/evaluate-engine.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add server/evaluate/prompt.js server/evaluate/engine.js server/__tests__/evaluate-engine.test.js
git commit -m "feat: add job evaluation engine (A-F rubric, GCC-aware)"
```

---

## Task 4: Evaluation API routes

**Files:**
- Create: `server/routes/evaluate.routes.js`
- Modify: `server/app.js`
- Test: `server/__tests__/api-evaluate.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/api-evaluate.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let tmpDir;
beforeEach(() => {
  vi.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmpDir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig() {
  fs.writeFileSync(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }),
  );
}
function stubGemini(jsonText) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }),
  })));
}

describe('evaluate API', () => {
  it('POST /api/evaluate returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/evaluate').send({ jobText: 'Accountant' });
    expect(res.status).toBe(409);
  });

  it('POST /api/evaluate returns 400 when jobText is missing', async () => {
    writeConfig();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/evaluate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/evaluate evaluates, saves, and returns the graded result', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).post('/api/evaluate').send({ jobText: 'Accountant role in Dubai' });
    expect(res.status).toBe(200);
    expect(res.body.grade).toBe('B');
    expect(res.body.id).toBeTruthy();
    const list = await request(app).get('/api/evaluations');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(res.body.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/api-evaluate.test.js`
Expected: FAIL — `/api/evaluate` not mounted.

- [ ] **Step 3: Implement the router**

`server/routes/evaluate.routes.js`:
```js
import { Router } from 'express';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { loadProfile } from '../profile/store.js';
import { evaluateJob } from '../evaluate/engine.js';
import { addEvaluation, listEvaluations, getEvaluation } from '../evaluate/store.js';

export function evaluateRouter() {
  const router = Router();

  router.post('/evaluate', async (req, res) => {
    try {
      const jobText = (req.body?.jobText ?? '').trim();
      if (!jobText) return res.status(400).json({ error: 'Please paste a job description.' });

      const config = loadConfig();
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before evaluating jobs.' });
      }

      const engine = createEngine(config);
      const profile = loadProfile();
      const result = await evaluateJob(profile, jobText, engine);
      const saved = addEvaluation(result);
      res.json(saved);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get('/evaluations', (req, res) => {
    try {
      res.json(listEvaluations());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/evaluations/:id', (req, res) => {
    const found = getEvaluation(req.params.id);
    if (!found) return res.status(404).json({ error: 'Evaluation not found.' });
    res.json(found);
  });

  return router;
}
```

- [ ] **Step 4: Mount in `server/app.js`**

Add the import near the other route imports:
```js
import { evaluateRouter } from './routes/evaluate.routes.js';
```
Then, immediately AFTER the `app.use('/api/profile', profileRouter());` line and BEFORE the `const webDist = ...` block, add:
```js
  app.use('/api', evaluateRouter());
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/api-evaluate.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all server tests green.

- [ ] **Step 7: Commit**

```bash
git add server/routes/evaluate.routes.js server/app.js server/__tests__/api-evaluate.test.js
git commit -m "feat: add evaluation API routes (evaluate + list + get)"
```

---

## Task 5: Front-end — Evaluate page, API client, nav, dashboard CTA

**Files:**
- Modify: `web/src/api.ts`, `web/src/App.tsx`, `web/src/components/Layout.tsx`, `web/src/pages/Dashboard.tsx`
- Create: `web/src/pages/EvaluatePage.tsx`

- [ ] **Step 1: Extend the API client**

Append to `web/src/api.ts` (keep existing exports + `checkOk`):
```ts
export interface Dimension { name: string; score: string; comment: string; }
export interface Evaluation {
  id: string;
  createdAt: string;
  jobTitle: string;
  company: string;
  location: string;
  grade: string;
  recommendation: 'apply' | 'maybe' | 'skip';
  summary: string;
  dimensions: Dimension[];
  matchedSkills: string[];
  missingSkills: string[];
}

export async function runEvaluation(jobText: string): Promise<Evaluation> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobText }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function listEvaluations(): Promise<Evaluation[]> {
  const res = await fetch('/api/evaluations').then(checkOk);
  return res.json();
}
```

- [ ] **Step 2: Create the Evaluate page**

`web/src/pages/EvaluatePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { runEvaluation, listEvaluations, type Evaluation } from '../api';

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-emerald-100 text-emerald-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-orange-100 text-orange-800',
  F: 'bg-red-100 text-red-800',
};
const REC_LABEL: Record<string, string> = { apply: '✅ Apply', maybe: '🤔 Maybe', skip: '🚫 Skip' };

function ResultCard({ ev }: { ev: Evaluation }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold ${GRADE_COLOR[ev.grade] ?? 'bg-slate-100 text-slate-700'}`}>
          {ev.grade}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{ev.jobTitle || 'This job'}{ev.company ? ` · ${ev.company}` : ''}</h2>
          {ev.location && <p className="text-sm text-slate-500">{ev.location}</p>}
          <p className="mt-1 text-sm font-medium">{REC_LABEL[ev.recommendation] ?? ev.recommendation}</p>
        </div>
      </div>

      <p className="text-slate-700">{ev.summary}</p>

      {ev.dimensions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {ev.dimensions.map((d, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{d.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${GRADE_COLOR[d.score] ?? 'bg-slate-100 text-slate-700'}`}>{d.score}</span>
              </div>
              {d.comment && <p className="mt-1 text-xs text-slate-500">{d.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Matched skills</p>
          <p className="text-sm text-slate-700">{ev.matchedSkills.length ? ev.matchedSkills.join(', ') : '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">Skills to add</p>
          <p className="text-sm text-slate-700">{ev.missingSkills.length ? ev.missingSkills.join(', ') : '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function EvaluatePage() {
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [recent, setRecent] = useState<Evaluation[]>([]);

  useEffect(() => {
    listEvaluations().then(setRecent).catch(() => {});
  }, []);

  async function onEvaluate() {
    if (!jobText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ev = await runEvaluation(jobText);
      setResult(ev);
      setRecent((r) => [ev, ...r]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Evaluate a Job</h1>
        <p className="mt-1 text-slate-600">Paste a job description and get an honest A–F fit score based on your profile.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Job description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
            rows={8}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job posting here…"
          />
        </label>
        <button
          onClick={onEvaluate}
          disabled={busy || !jobText.trim()}
          className="mt-3 px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Evaluating…' : 'Evaluate'}
        </button>
        {error && <div className="mt-3 text-sm rounded-lg p-3 bg-red-50 text-red-700">{error}</div>}
      </div>

      {result && <ResultCard ev={result} />}

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-slate-800">Recent evaluations</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700">{ev.jobTitle || 'Job'}{ev.company ? ` · ${ev.company}` : ''}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${GRADE_COLOR[ev.grade] ?? 'bg-slate-100 text-slate-700'}`}>{ev.grade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2b: Add the nav link**

In `web/src/components/Layout.tsx`, add a third `NavLink` after the "My Profile" link:
```tsx
          <NavLink to="/evaluate" label="Evaluate Jobs" />
```

- [ ] **Step 3: Add the route**

In `web/src/App.tsx`, import the page and add the route:
```tsx
import EvaluatePage from './pages/EvaluatePage';
```
Add inside `<Routes>` (after the `/profile` route):
```tsx
          <Route path="/evaluate" element={<EvaluatePage />} />
```

- [ ] **Step 4: Add a Dashboard CTA**

In `web/src/pages/Dashboard.tsx`, change the closing hint paragraph to a second action card. Replace:
```tsx
      <p className="mt-6 text-sm text-slate-400">
        Coming next: job evaluation, tailored resumes & cover letters, and GCC job scanning.
      </p>
```
with:
```tsx
      <div className="mt-4 bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-slate-800">Step 2: Evaluate a job</h2>
        <p className="mt-1 text-sm text-slate-500">Paste any job description to get an A–F fit score based on your profile.</p>
        <Link to="/evaluate" className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          Evaluate a Job →
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Coming next: tailored resumes & cover letters, and GCC job scanning.
      </p>
```

- [ ] **Step 5: Build to typecheck**

Run: `npm --prefix web run build`
Expected: builds with ZERO TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/api.ts web/src/App.tsx web/src/components/Layout.tsx web/src/pages/Dashboard.tsx web/src/pages/EvaluatePage.tsx
git commit -m "feat: add Evaluate Jobs page, nav, and dashboard CTA"
```

- [ ] **Step 7: Full integration acceptance (manual)**

- `NO_OPEN=1 node server/index.js &` → open `http://localhost:5123/evaluate` (setup must be complete from Phase 1; profile helps but is optional).
- Paste a real job description, click **Evaluate**. Confirm a graded card appears (A–F badge, recommendation, summary, dimension grid, matched/missing skills) — requires a working AI engine.
- Confirm the evaluation appears under **Recent evaluations**.
- Refresh → recent list still shows it (proves `data/evaluations.json` persistence).
- Stop the server.

---

## Self-Review

**1. Spec coverage (design spec §9 Phase 3):**
- "Paste a job description → AI evaluation → A–F fit score across dimensions, plain-language reasons, apply/skip recommendation" → Task 3 (engine: grade + dimensions + summary + recommendation), Task 5 (paste UI + result card). ✓
- "Ports Career-Ops rubric" → Task 3 prompt with A–F rubric + dimensions, GCC-aware (location/relocation fit dimension). ✓
- "result saved to DB" → Task 2 store + Task 4 route saving each evaluation (JSON store; SQLite deferred to tracker phase, consistent with Phase 2). ✓
- Acceptance "paste sample JD → structured score + readable reasoning rendered; result saved" → Task 5 Step 7. ✓

**2. Placeholder scan:** No TBD/TODO; every code step is complete. App.tsx/Layout/Dashboard edits are additive and self-contained within Task 5 (no cross-task forward reference needing deferral). ✓

**3. Type consistency:** Server `normalizeEvaluation` keys (jobTitle, company, location, grade, recommendation, summary, dimensions[{name,score,comment}], matchedSkills, missingSkills) match the AI prompt's required keys (Task 3) and the front-end `Evaluation`/`Dimension` interfaces (Task 5). Store `addEvaluation` adds `id` + `createdAt`, both present in the `Evaluation` interface. Route paths (`/api/evaluate`, `/api/evaluations`) match the client calls. `extractJson` is imported from the shared `lib/json.js` by both `profile/parse.js` (Task 1) and `evaluate/engine.js` (Task 3). ✓

No issues found.
