# Phase 4 — Resume Tailoring + Cover Letter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** From a saved evaluation (or a pasted job description), generate a tailored, ATS-friendly **resume** and **cover letter** in Markdown, show them in an **editable** preview, and **save** the edited versions locally. (PDF export is Phase 5.)

**Architecture:** A new `server/documents/` module (prompt + engine) produces `{ resumeMarkdown, coverLetterMarkdown }` from the profile + job text via the existing AI adapter. A JSON-file store (`data/documents.json`) persists saved documents (create/list/get/update). Evaluations now also persist their `jobText` so documents can be generated straight from a prior evaluation. New routes under `/api/documents`. The front-end gains a Documents page (pick an evaluated job or paste one → Generate → edit two textareas → Save), a nav entry, a "Tailor" button on the Evaluate result, and a Dashboard CTA.

**Tech Stack:** Existing Node/Express + AI adapter + shared `lib/json.js` + JSON-file stores; React + Vite + Tailwind + react-router. Tests: Vitest + Supertest with mocked AI/fetch. Documents are Markdown (inherently ATS-friendly; rendered to PDF in Phase 5).

---

## File Structure

```
server/
  documents/
    prompt.js              # DOC_SYSTEM + buildDocumentsPrompt(profile, jobText)
    engine.js              # generateDocuments(profile, jobText, engine) -> {resumeMarkdown, coverLetterMarkdown}
    store.js               # list/add/get/update -> data/documents.json
  routes/
    documents.routes.js    # /api/documents/generate, GET/POST /api/documents, GET/POST /api/documents/:id
    evaluate.routes.js     # MODIFY: persist jobText on the saved evaluation
  app.js                   # MODIFY: mount documentsRouter
  __tests__/
    documents-store.test.js
    documents-engine.test.js
    api-documents.test.js
    api-evaluate.test.js   # MODIFY: assert jobText is persisted
web/
  src/
    api.ts                 # MODIFY: Document types + generateDocuments/saveDocument/updateDocument/listDocuments/getDocument
    App.tsx                # MODIFY: add /documents route
    components/Layout.tsx  # MODIFY: add "Documents" nav link
    pages/DocumentsPage.tsx# generate + edit + save + recent list
    pages/EvaluatePage.tsx # MODIFY: add "Tailor resume & cover letter" button on the result card
    pages/Dashboard.tsx    # MODIFY: add documents CTA
```

---

## Task 1: Documents store (JSON file)

**Files:**
- Create: `server/documents/store.js`
- Test: `server/__tests__/documents-store.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/documents-store.test.js`:
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

describe('documents store', () => {
  it('starts empty', async () => {
    const { listDocuments } = await import('../documents/store.js');
    expect(listDocuments()).toEqual([]);
  });

  it('adds a document with id + timestamps, newest first', async () => {
    const { addDocument, listDocuments } = await import('../documents/store.js');
    const a = addDocument({ jobTitle: 'A', resumeMarkdown: '# A' });
    const b = addDocument({ jobTitle: 'B', resumeMarkdown: '# B' });
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeTruthy();
    expect(a.updatedAt).toBeTruthy();
    const list = listDocuments();
    expect(list).toHaveLength(2);
    expect(list[0].jobTitle).toBe('B');
  });

  it('gets by id and updates content (touching updatedAt, preserving id/createdAt)', async () => {
    const { addDocument, getDocument, updateDocument } = await import('../documents/store.js');
    const a = addDocument({ jobTitle: 'X', resumeMarkdown: 'old' });
    expect(getDocument(a.id).resumeMarkdown).toBe('old');
    const updated = updateDocument(a.id, { resumeMarkdown: 'new', id: 'hacked', createdAt: 'hacked' });
    expect(updated.resumeMarkdown).toBe('new');
    expect(updated.id).toBe(a.id);            // id not overwritten
    expect(updated.createdAt).toBe(a.createdAt); // createdAt preserved
    expect(updateDocument('missing', {})).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/documents-store.test.js`
Expected: FAIL — cannot find `../documents/store.js`.

- [ ] **Step 3: Implement**

`server/documents/store.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';

function storePath() {
  return path.join(dataDir(), 'documents.json');
}

export function listDocuments() {
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
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addDocument(doc) {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = doc ?? {};
  const now = new Date().toISOString();
  const record = { ...rest, id: newId(), createdAt: now, updatedAt: now };
  const list = listDocuments();
  list.unshift(record);
  writeAll(list);
  return record;
}

export function getDocument(id) {
  return listDocuments().find((d) => d.id === id) ?? null;
}

export function updateDocument(id, patch) {
  const list = listDocuments();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const { id: _i, createdAt: _c, ...rest } = patch ?? {};
  list[idx] = { ...list[idx], ...rest, updatedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/documents-store.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add server/documents/store.js server/__tests__/documents-store.test.js
git commit -m "feat: add documents JSON store"
```

---

## Task 2: Persist jobText on evaluations

**Files:**
- Modify: `server/routes/evaluate.routes.js`
- Modify: `server/__tests__/api-evaluate.test.js`

- [ ] **Step 1: Add a failing assertion**

In `server/__tests__/api-evaluate.test.js`, add this test inside the `describe('evaluate API', ...)` block (it reuses the existing `writeConfig()` / `stubGemini()` helpers):
```js
  it('POST /api/evaluate persists the original jobText on the saved evaluation', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const res = await request(app).post('/api/evaluate').send({ jobText: 'UNIQUE-JOB-TEXT-12345' });
    const fetched = await request(app).get(`/api/evaluations/${res.body.id}`);
    expect(fetched.body.jobText).toBe('UNIQUE-JOB-TEXT-12345');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/api-evaluate.test.js`
Expected: FAIL — `jobText` is undefined on the saved evaluation.

- [ ] **Step 3: Implement**

In `server/routes/evaluate.routes.js`, in the `POST /evaluate` handler, change the save line from:
```js
      const result = await evaluateJob(profile, jobText, engine);
      const saved = addEvaluation(result);
```
to:
```js
      const result = await evaluateJob(profile, jobText, engine);
      const saved = addEvaluation({ ...result, jobText });
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — the new assertion passes and all existing tests stay green.

- [ ] **Step 5: Commit**

```bash
git add server/routes/evaluate.routes.js server/__tests__/api-evaluate.test.js
git commit -m "feat: persist jobText on evaluations for later tailoring"
```

---

## Task 3: Documents engine (prompt + generate)

**Files:**
- Create: `server/documents/prompt.js`, `server/documents/engine.js`
- Test: `server/__tests__/documents-engine.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/documents-engine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { generateDocuments } from '../documents/engine.js';

const PROFILE = { fullName: 'Jane', headline: 'Accountant', skills: ['Excel'] };

describe('generateDocuments', () => {
  it('returns resume and cover letter markdown from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({ resumeMarkdown: '# Jane\\nResume', coverLetterMarkdown: 'Dear Hiring Manager,' }),
    };
    const docs = await generateDocuments(PROFILE, 'Accountant role', engine);
    expect(docs.resumeMarkdown).toContain('Jane');
    expect(docs.coverLetterMarkdown).toContain('Dear');
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'no json here' };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/Could not understand/);
  });

  it('throws when the AI returns empty document content', async () => {
    const engine = { generate: async () => JSON.stringify({ resumeMarkdown: '', coverLetterMarkdown: '' }) };
    await expect(generateDocuments(PROFILE, 'job', engine)).rejects.toThrow(/did not return/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/documents-engine.test.js`
Expected: FAIL — cannot find `../documents/engine.js`.

- [ ] **Step 3: Implement the prompt**

`server/documents/prompt.js`:
```js
export const DOC_SYSTEM =
  'You are an expert resume writer for candidates job-hunting in the GCC (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman). You write clear, ATS-friendly resumes and cover letters in Markdown. Return ONLY valid JSON, no commentary.';

export function buildDocumentsPrompt(profile, jobText) {
  return `Using the candidate profile and the job description, write two documents.

1. A tailored, ATS-friendly RESUME in Markdown: concise, achievement-focused, naturally incorporating keywords from the job description. Reshape and emphasize ONLY what the profile already contains — do NOT invent experience, employers, dates, or qualifications.
2. A tailored COVER LETTER in Markdown: professional and specific to this role/company, 3-4 short paragraphs.

Return JSON with EXACTLY these keys:
{
  "resumeMarkdown": string,
  "coverLetterMarkdown": string
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

`server/documents/engine.js`:
```js
import { extractJson } from '../lib/json.js';
import { DOC_SYSTEM, buildDocumentsPrompt } from './prompt.js';

function normalizeDocuments(raw = {}) {
  return {
    resumeMarkdown: typeof raw.resumeMarkdown === 'string' ? raw.resumeMarkdown : '',
    coverLetterMarkdown: typeof raw.coverLetterMarkdown === 'string' ? raw.coverLetterMarkdown : '',
  };
}

export async function generateDocuments(profile, jobText, engine) {
  const raw = await engine.generate({
    system: DOC_SYSTEM,
    prompt: buildDocumentsPrompt(profile, jobText),
  });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while writing your documents. ${e.message}`);
  }
  const docs = normalizeDocuments(parsed);
  if (!docs.resumeMarkdown && !docs.coverLetterMarkdown) {
    throw new Error('The AI did not return any document content. Please try again.');
  }
  return docs;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/documents-engine.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add server/documents/prompt.js server/documents/engine.js server/__tests__/documents-engine.test.js
git commit -m "feat: add documents engine (tailored resume + cover letter)"
```

---

## Task 4: Documents API routes

**Files:**
- Create: `server/routes/documents.routes.js`
- Modify: `server/app.js`
- Test: `server/__tests__/api-documents.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/api-documents.test.js`:
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

describe('documents API', () => {
  it('POST /api/documents/generate returns 409 when AI is not configured', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({ jobText: 'x' });
    expect(res.status).toBe(409);
  });

  it('POST /api/documents/generate returns 400 with no jobText and no evaluationId', async () => {
    writeConfig();
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/documents/generate returns tailored markdown from pasted jobText', async () => {
    writeConfig();
    stubGemini(JSON.stringify({ resumeMarkdown: '# Jane', coverLetterMarkdown: 'Dear team' }));
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/documents/generate').send({ jobText: 'Accountant', jobTitle: 'Accountant', company: 'ACME' });
    expect(res.status).toBe(200);
    expect(res.body.resumeMarkdown).toContain('Jane');
    expect(res.body.coverLetterMarkdown).toContain('Dear');
    expect(res.body.jobTitle).toBe('Accountant');
  });

  it('POST /api/documents/generate can pull jobText from a saved evaluation', async () => {
    writeConfig();
    // First create an evaluation (eval-shaped JSON), capturing its id.
    stubGemini(JSON.stringify({ jobTitle: 'Accountant', grade: 'B', recommendation: 'apply', summary: 'ok', dimensions: [], matchedSkills: [], missingSkills: [] }));
    const { createApp } = await import('../app.js');
    const app = createApp();
    const ev = await request(app).post('/api/evaluate').send({ jobText: 'EVAL-JOB-TEXT' });
    // Now re-stub with doc-shaped JSON and generate from that evaluation.
    stubGemini(JSON.stringify({ resumeMarkdown: '# Tailored', coverLetterMarkdown: 'Hello' }));
    const res = await request(app).post('/api/documents/generate').send({ evaluationId: ev.body.id });
    expect(res.status).toBe(200);
    expect(res.body.resumeMarkdown).toContain('Tailored');
    expect(res.body.evaluationId).toBe(ev.body.id);
  });

  it('saves, lists, gets, and updates a document', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    const created = await request(app).post('/api/documents').send({ jobTitle: 'A', resumeMarkdown: 'r', coverLetterMarkdown: 'c' });
    expect(created.body.id).toBeTruthy();
    const list = await request(app).get('/api/documents');
    expect(list.body).toHaveLength(1);
    const got = await request(app).get(`/api/documents/${created.body.id}`);
    expect(got.body.resumeMarkdown).toBe('r');
    const updated = await request(app).post(`/api/documents/${created.body.id}`).send({ resumeMarkdown: 'r2' });
    expect(updated.body.resumeMarkdown).toBe('r2');
    const missing = await request(app).post('/api/documents/nope').send({ resumeMarkdown: 'x' });
    expect(missing.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/api-documents.test.js`
Expected: FAIL — `/api/documents` not mounted.

- [ ] **Step 3: Implement the router**

`server/routes/documents.routes.js`:
```js
import { Router } from 'express';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';
import { loadProfile } from '../profile/store.js';
import { getEvaluation } from '../evaluate/store.js';
import { generateDocuments } from '../documents/engine.js';
import { listDocuments, addDocument, getDocument, updateDocument } from '../documents/store.js';

export function documentsRouter() {
  const router = Router();

  router.post('/documents/generate', async (req, res) => {
    try {
      const config = loadConfig();
      if (!config.setupComplete) {
        return res.status(409).json({ error: 'Please complete the AI setup wizard before generating documents.' });
      }

      let jobText = (req.body?.jobText ?? '').trim();
      let jobTitle = req.body?.jobTitle ?? '';
      let company = req.body?.company ?? '';
      const evaluationId = req.body?.evaluationId ?? null;

      if (evaluationId) {
        const ev = getEvaluation(evaluationId);
        if (!ev) return res.status(404).json({ error: 'Evaluation not found.' });
        jobText = (ev.jobText ?? jobText ?? '').trim();
        jobTitle = jobTitle || ev.jobTitle || '';
        company = company || ev.company || '';
      }

      if (!jobText) {
        return res.status(400).json({ error: 'Please provide a job description, or pick an evaluated job.' });
      }

      const engine = createEngine(config);
      const profile = loadProfile();
      const docs = await generateDocuments(profile, jobText, engine);
      res.json({ ...docs, jobTitle, company, evaluationId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/documents', (req, res) => {
    try {
      res.json(listDocuments());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/documents', (req, res) => {
    try {
      res.json(addDocument(req.body ?? {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/documents/:id', (req, res) => {
    try {
      const found = getDocument(req.params.id);
      if (!found) return res.status(404).json({ error: 'Document not found.' });
      res.json(found);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/documents/:id', (req, res) => {
    try {
      const updated = updateDocument(req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ error: 'Document not found.' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
```

> Route-order note: `POST /documents/generate` is registered before `POST /documents/:id`, so "generate" is never treated as an `:id`. `POST /documents` (no id) maps to create.

- [ ] **Step 4: Mount in `server/app.js`**

Add the import near the other route imports:
```js
import { documentsRouter } from './routes/documents.routes.js';
```
Then, immediately AFTER the `app.use('/api', evaluateRouter());` line and BEFORE the `const webDist = ...` block, add:
```js
  app.use('/api', documentsRouter());
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/api-documents.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all server tests green.

- [ ] **Step 7: Commit**

```bash
git add server/routes/documents.routes.js server/app.js server/__tests__/api-documents.test.js
git commit -m "feat: add documents API routes (generate + save + list + get + update)"
```

---

## Task 5: Front-end — Documents page, API client, nav, Evaluate button, Dashboard CTA

**Files:**
- Modify: `web/src/api.ts`, `web/src/App.tsx`, `web/src/components/Layout.tsx`, `web/src/pages/EvaluatePage.tsx`, `web/src/pages/Dashboard.tsx`
- Create: `web/src/pages/DocumentsPage.tsx`

- [ ] **Step 1: Extend the API client**

Append to `web/src/api.ts` (keep existing exports + `checkOk`):
```ts
export interface DocumentDraft {
  resumeMarkdown: string;
  coverLetterMarkdown: string;
  jobTitle: string;
  company: string;
  evaluationId: string | null;
}
export interface DocumentRecord extends DocumentDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function generateDocuments(body: {
  jobText?: string;
  jobTitle?: string;
  company?: string;
  evaluationId?: string | null;
}): Promise<DocumentDraft> {
  const res = await fetch('/api/documents/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(e.error || `Server error ${res.status}`);
  }
  return res.json();
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch('/api/documents').then(checkOk);
  return res.json();
}

export async function saveDocument(doc: Partial<DocumentRecord>): Promise<DocumentRecord> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc),
  }).then(checkOk);
  return res.json();
}

export async function updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(checkOk);
  return res.json();
}
```

- [ ] **Step 2: Create the Documents page**

`web/src/pages/DocumentsPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  generateDocuments,
  listDocuments,
  saveDocument,
  updateDocument,
  listEvaluations,
  type DocumentRecord,
  type Evaluation,
} from '../api';

export default function DocumentsPage() {
  const [params] = useSearchParams();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [evalId, setEvalId] = useState<string>(params.get('eval') ?? '');
  const [jobText, setJobText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [resume, setResume] = useState('');
  const [cover, setCover] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    listEvaluations().then(setEvals).catch(() => {});
    listDocuments().then(setRecent).catch(() => {});
  }, []);

  const hasContent = resume.trim() || cover.trim();

  async function onGenerate() {
    setBusy(true);
    setMessage(null);
    try {
      const body = evalId ? { evaluationId: evalId } : { jobText, jobTitle, company };
      const draft = await generateDocuments(body);
      setResume(draft.resumeMarkdown);
      setCover(draft.coverLetterMarkdown);
      setJobTitle(draft.jobTitle);
      setCompany(draft.company);
      setDocId(null); // fresh draft, not yet saved
      setMessage({ ok: true, text: 'Documents generated! Edit below, then Save.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Generation failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover };
      const saved = docId ? await updateDocument(docId, payload) : await saveDocument(payload);
      setDocId(saved.id);
      setRecent(await listDocuments());
      setMessage({ ok: true, text: 'Saved.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function loadDoc(d: DocumentRecord) {
    setDocId(d.id);
    setJobTitle(d.jobTitle);
    setCompany(d.company);
    setEvalId(d.evaluationId ?? '');
    setResume(d.resumeMarkdown);
    setCover(d.coverLetterMarkdown);
    setMessage(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Resume & Cover Letter</h1>
        <p className="mt-1 text-slate-600">Generate a tailored resume and cover letter, edit them, and save.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        {evals.length > 0 && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Use an evaluated job</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
              value={evalId}
              onChange={(e) => setEvalId(e.target.value)}
            >
              <option value="">— Paste a job instead —</option>
              {evals.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {(ev.jobTitle || 'Job')}{ev.company ? ` · ${ev.company}` : ''} ({ev.grade})
                </option>
              ))}
            </select>
          </label>
        )}

        {!evalId && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Or paste a job description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={5}
              value={jobText}
              disabled={busy}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the job posting here…"
            />
          </label>
        )}

        <button
          onClick={onGenerate}
          disabled={busy || (!evalId && !jobText.trim())}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Writing…' : 'Generate'}
        </button>
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {hasContent && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-slate-800">Resume (Markdown)</h2>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-mono"
              rows={20}
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-slate-800">Cover letter (Markdown)</h2>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-mono"
              rows={20}
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
          </div>
        </div>
      )}

      {hasContent && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
            {saving ? 'Saving…' : docId ? 'Update saved documents' : 'Save documents'}
          </button>
          <span className="text-xs text-slate-400">Download as PDF arrives in the next phase.</span>
        </div>
      )}

      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-slate-800">Saved documents</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {recent.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700">{d.jobTitle || 'Documents'}{d.company ? ` · ${d.company}` : ''}</span>
                <button onClick={() => loadDoc(d)} className="text-sm text-blue-600">Open</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `web/src/components/Layout.tsx`, add after the "Evaluate Jobs" link (inside the `<nav>`):
```tsx
            <NavLink to="/documents" label="Documents" />
```

- [ ] **Step 4: Add the route**

In `web/src/App.tsx`, import and add the route after `/evaluate`:
```tsx
import DocumentsPage from './pages/DocumentsPage';
```
```tsx
          <Route path="/documents" element={<DocumentsPage />} />
```

- [ ] **Step 5: Add the "Tailor" button on the Evaluate result card**

In `web/src/pages/EvaluatePage.tsx`:
- Add the import at the top:
```tsx
import { Link } from 'react-router-dom';
```
- The `ResultCard` component is defined with signature `function ResultCard({ ev }: { ev: Evaluation })`. Add a Tailor link at the END of the card, just before its closing `</div>`. Insert this block as the last child inside the card's outer `<div className="bg-white rounded-2xl shadow p-6 space-y-4">`:
```tsx
      <Link
        to={`/documents?eval=${ev.id}`}
        className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
      >
        Tailor resume & cover letter →
      </Link>
```

- [ ] **Step 6: Add a Dashboard CTA**

In `web/src/pages/Dashboard.tsx`, replace the final hint paragraph:
```tsx
      <p className="mt-6 text-sm text-slate-400">
        Coming next: tailored resumes & cover letters, and GCC job scanning.
      </p>
```
with:
```tsx
      <div className="mt-4 bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-slate-800">Step 3: Tailor your resume</h2>
        <p className="mt-1 text-sm text-slate-500">Generate a tailored resume and cover letter for any job.</p>
        <Link to="/documents" className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">
          Resume & Cover Letter →
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-400">Coming next: PDF download, and GCC job scanning.</p>
```

- [ ] **Step 7: Build to typecheck**

Run: `npm --prefix web run build`
Expected: builds with ZERO TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/api.ts web/src/App.tsx web/src/components/Layout.tsx web/src/pages/DocumentsPage.tsx web/src/pages/EvaluatePage.tsx web/src/pages/Dashboard.tsx
git commit -m "feat: add Documents page (tailored resume + cover letter), nav, links"
```

- [ ] **Step 9: Full integration acceptance (manual)**

- `NO_OPEN=1 node server/index.js &` → open `http://localhost:5123/documents` (setup complete + a profile + at least one evaluation give the best result).
- Pick an evaluated job (or paste a JD) → click **Generate** → confirm the resume and cover letter textareas fill in (requires a working AI engine).
- Edit some text → click **Save documents** → see "Saved"; it appears under **Saved documents**.
- Click **Open** on a saved item → it reloads into the editors. Edit → **Update saved documents** → "Saved".
- Refresh → saved documents persist (proves `data/documents.json`).
- From the **Evaluate Jobs** page, run an evaluation → click **Tailor resume & cover letter →** → lands on Documents with that job preselected.
- Stop the server.

---

## Self-Review

**1. Spec coverage (design spec §9 Phase 4):**
- "From an evaluation, generate a tailored, ATS-friendly resume + cover letter" → Task 3 (engine), Task 2 (jobText persisted so generation can use a saved evaluation), Task 4 (`/documents/generate` with `evaluationId`), Task 5 (eval picker + Tailor button). ✓
- "editable preview" → Task 5 (two editable Markdown textareas shown after generation). ✓
- Acceptance "Generate from an evaluation → edit text → changes reflected and saved" → Task 5 Step 9 + Task 4 save/update routes + Task 1 store. ✓
- ATS-friendly → Markdown output, prompt instructs ATS-friendly and "do not invent". ✓

**2. Placeholder scan:** No TBD/TODO; all code complete. Additive App.tsx/Layout/Dashboard/Evaluate edits are self-contained in Task 5. ✓

**3. Type consistency:** Server `generateDocuments` returns `{resumeMarkdown, coverLetterMarkdown}`; the route augments with `{jobTitle, company, evaluationId}` → matches the web `DocumentDraft` interface (Task 5). Store records add `{id, createdAt, updatedAt}` → matches `DocumentRecord extends DocumentDraft`. `updateDocument`/`addDocument` strip id/createdAt (Task 1) consistent with the evaluations store pattern. Route paths (`/api/documents/generate`, `/api/documents`, `/api/documents/:id`) match the client functions. `Evaluation` already includes `id`/`jobTitle`/`company`/`grade` used by the picker; `jobText` (added Task 2) is read server-side only. ✓

No issues found.
