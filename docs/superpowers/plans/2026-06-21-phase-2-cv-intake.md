# Phase 2 — Profile & Resume Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a user upload an existing CV (PDF / Word / text) — or fill a guided form — and have the AI parse it into an editable, structured profile that is saved locally and persists across restarts.

**Architecture:** A new `server/profile/` module (schema, JSON-file store, text extraction, AI parsing) plus a `server/routes/profile.routes.js` router mounted at `/api/profile`. The import endpoint accepts a multipart upload, extracts raw text (pdf-parse / mammoth / plain), runs it through the existing AI adapter, and returns structured JSON for the user to review before saving. The front-end gains React Router, a small app layout/nav, a Dashboard page, and a ProfilePage (upload → editable form → save).

**Tech Stack:** Existing Node/Express + AI adapter; new deps `multer`, `pdf-parse`, `mammoth` (server) and `react-router-dom` (web). Profile stored as `data/profile.json` (git-ignored). Tests: Vitest + Supertest with mocked AI/fetch.

---

## File Structure

```
server/
  profile/
    schema.js            # EMPTY_PROFILE + normalizeProfile()
    store.js             # loadProfile() / saveProfile() -> data/profile.json
    extract.js           # extractText(buffer, filename) -> string (pdf/docx/txt)
    parse.js             # extractJson() + parseCvText(text, engine) -> structured profile
  routes/
    profile.routes.js    # profileRouter(): GET/POST /api/profile, POST /api/profile/import
  app.js                 # MODIFY: mount profileRouter at /api/profile
  __tests__/
    profile-store.test.js
    profile-extract.test.js
    profile-parse.test.js
    api-profile.test.js
web/
  package.json           # MODIFY: add react-router-dom
  src/
    api.ts               # MODIFY: Profile types + getProfile/saveProfile/importCv
    App.tsx              # MODIFY: add router; wizard when !setupComplete, else routed app
    components/Layout.tsx# nav shell
    pages/Dashboard.tsx  # replaces Home; status + CTA to profile
    pages/ProfilePage.tsx# upload + editable form + save
    pages/Home.tsx       # DELETE (replaced by Dashboard)
```

---

## Task 1: Profile schema, JSON store, and dependencies

**Files:**
- Create: `server/profile/schema.js`, `server/profile/store.js`
- Test: `server/__tests__/profile-store.test.js`

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install multer@^1.4.5-lts.1 pdf-parse@^1.1.1 mammoth@^1.8.0
```
Expected: installs without errors.

- [ ] **Step 2: Write the failing test**

`server/__tests__/profile-store.test.js`:
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

describe('profile store', () => {
  it('returns an empty profile when none exists', async () => {
    const { loadProfile } = await import('../profile/store.js');
    const p = loadProfile();
    expect(p.fullName).toBe('');
    expect(Array.isArray(p.skills)).toBe(true);
    expect(p.skills).toHaveLength(0);
  });

  it('saves and reloads a profile, stamping updatedAt', async () => {
    const { saveProfile, loadProfile } = await import('../profile/store.js');
    const saved = saveProfile({ fullName: 'Jane Doe', skills: ['Node', 'React'] });
    expect(saved.updatedAt).toBeTruthy();
    const p = loadProfile();
    expect(p.fullName).toBe('Jane Doe');
    expect(p.skills).toEqual(['Node', 'React']);
  });

  it('normalizes malformed array fields to empty arrays', async () => {
    const { saveProfile, loadProfile } = await import('../profile/store.js');
    saveProfile({ fullName: 'X', skills: 'not-an-array' });
    const p = loadProfile();
    expect(p.skills).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/__tests__/profile-store.test.js`
Expected: FAIL — cannot find `../profile/store.js`.

- [ ] **Step 4: Implement**

`server/profile/schema.js`:
```js
export const EMPTY_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  headline: '',
  summary: '',
  skills: [],
  experience: [], // { company, title, startDate, endDate, description }
  education: [],  // { institution, degree, field, year }
  links: [],
  updatedAt: null,
};

export function normalizeProfile(raw = {}) {
  return {
    ...EMPTY_PROFILE,
    ...raw,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    experience: Array.isArray(raw.experience) ? raw.experience : [],
    education: Array.isArray(raw.education) ? raw.education : [],
    links: Array.isArray(raw.links) ? raw.links : [],
  };
}
```

`server/profile/store.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { EMPTY_PROFILE, normalizeProfile } from './schema.js';

function profilePath() {
  return path.join(dataDir(), 'profile.json');
}

export function loadProfile() {
  const p = profilePath();
  if (!fs.existsSync(p)) return { ...EMPTY_PROFILE };
  try {
    return normalizeProfile(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(profile) {
  const next = { ...normalizeProfile(profile), updatedAt: new Date().toISOString() };
  const p = profilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2));
  return next;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/profile-store.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add server/profile/schema.js server/profile/store.js server/__tests__/profile-store.test.js package.json package-lock.json
git commit -m "feat: add profile schema and JSON store"
```

---

## Task 2: CV text extraction (PDF / DOCX / text)

**Files:**
- Create: `server/profile/extract.js`
- Test: `server/__tests__/profile-extract.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/profile-extract.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.resetAllMocks());

describe('extractText', () => {
  it('reads plain text files directly', async () => {
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('Hello CV'), 'resume.txt');
    expect(out).toBe('Hello CV');
  });

  it('throws a friendly error for unsupported types', async () => {
    const { extractText } = await import('../profile/extract.js');
    await expect(extractText(Buffer.from('x'), 'resume.png')).rejects.toThrow(/Unsupported/);
  });

  it('uses pdf-parse for .pdf files', async () => {
    vi.doMock('pdf-parse', () => ({ default: vi.fn(async () => ({ text: 'PDF TEXT' })) }));
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('%PDF'), 'resume.pdf');
    expect(out).toBe('PDF TEXT');
  });

  it('uses mammoth for .docx files', async () => {
    vi.doMock('mammoth', () => ({ default: { extractRawText: vi.fn(async () => ({ value: 'DOCX TEXT' })) } }));
    const { extractText } = await import('../profile/extract.js');
    const out = await extractText(Buffer.from('PK'), 'resume.docx');
    expect(out).toBe('DOCX TEXT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/profile-extract.test.js`
Expected: FAIL — cannot find `../profile/extract.js`.

- [ ] **Step 3: Implement**

`server/profile/extract.js`:
```js
import path from 'node:path';

export async function extractText(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  if (ext === '.txt' || ext === '.md') {
    return buffer.toString('utf8');
  }

  if (ext === '.pdf') {
    const mod = await import('pdf-parse');
    const pdfParse = mod.default ?? mod;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const mod = await import('mammoth');
    const mammoth = mod.default ?? mod;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type "${ext || 'unknown'}". Please upload a PDF, Word (.docx), or text file.`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/profile-extract.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/profile/extract.js server/__tests__/profile-extract.test.js
git commit -m "feat: add CV text extraction for pdf/docx/text"
```

---

## Task 3: AI parsing of CV text into structured profile

**Files:**
- Create: `server/profile/parse.js`
- Test: `server/__tests__/profile-parse.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/profile-parse.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractJson, parseCvText } from '../profile/parse.js';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"fullName":"Jane"}').fullName).toBe('Jane');
  });
  it('parses JSON inside a code fence', () => {
    expect(extractJson('```json\n{"fullName":"Bob"}\n```').fullName).toBe('Bob');
  });
  it('parses JSON with surrounding prose', () => {
    expect(extractJson('Here you go:\n{"fullName":"Sue"}\nThanks').fullName).toBe('Sue');
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parseCvText', () => {
  it('returns the structured object from the engine response', async () => {
    const engine = { generate: async () => '```json\n{"fullName":"Jane Doe","skills":["Node"]}\n```' };
    const result = await parseCvText('Jane Doe, Node developer', engine);
    expect(result.fullName).toBe('Jane Doe');
    expect(result.skills).toEqual(['Node']);
  });

  it('throws a friendly error when the engine returns junk', async () => {
    const engine = { generate: async () => 'sorry I cannot help' };
    await expect(parseCvText('x', engine)).rejects.toThrow(/Could not understand/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/profile-parse.test.js`
Expected: FAIL — cannot find `../profile/parse.js`.

- [ ] **Step 3: Implement**

`server/profile/parse.js`:
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

const SYSTEM = 'You convert a raw CV/resume into structured JSON. Return ONLY valid JSON, no commentary.';

function buildPrompt(cvText) {
  return `Extract this resume into JSON with EXACTLY these keys:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "headline": string,
  "summary": string,
  "skills": string[],
  "experience": [ { "company": string, "title": string, "startDate": string, "endDate": string, "description": string } ],
  "education": [ { "institution": string, "degree": string, "field": string, "year": string } ],
  "links": string[]
}
Use empty strings/arrays for anything not present. Do not invent information.

RESUME:
"""
${cvText}
"""`;
}

export async function parseCvText(cvText, engine) {
  const raw = await engine.generate({ system: SYSTEM, prompt: buildPrompt(cvText) });
  try {
    return extractJson(raw);
  } catch (e) {
    throw new Error(`Could not understand the AI response while reading your CV. ${e.message}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/profile-parse.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add server/profile/parse.js server/__tests__/profile-parse.test.js
git commit -m "feat: add AI CV parsing into structured profile"
```

---

## Task 4: Profile API routes

**Files:**
- Create: `server/routes/profile.routes.js`
- Modify: `server/app.js`
- Test: `server/__tests__/api-profile.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/api-profile.test.js`:
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

describe('profile API', () => {
  it('GET /api/profile returns an empty profile', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('');
  });

  it('POST /api/profile saves and GET reflects it', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();
    await request(app).post('/api/profile').send({ fullName: 'Jane Doe' });
    const res = await request(app).get('/api/profile');
    expect(res.body.fullName).toBe('Jane Doe');
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('POST /api/profile/import parses an uploaded text CV via the AI engine', async () => {
    // Config: use gemini so createEngine builds the Gemini engine; stub fetch.
    fs.writeFileSync(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true }),
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"fullName":"Jane Doe","skills":["Node"]}' }] } }],
      }),
    })));
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/api/profile/import')
      .attach('cv', Buffer.from('Jane Doe — Node developer'), 'resume.txt');
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Jane Doe');
    expect(res.body.skills).toEqual(['Node']);
  });

  it('POST /api/profile/import returns 400 when no file is attached', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/api/profile/import');
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/api-profile.test.js`
Expected: FAIL — `/api/profile` not mounted / router missing.

- [ ] **Step 3: Implement the router**

`server/routes/profile.routes.js`:
```js
import { Router } from 'express';
import multer from 'multer';
import { loadProfile, saveProfile } from '../profile/store.js';
import { extractText } from '../profile/extract.js';
import { parseCvText } from '../profile/parse.js';
import { normalizeProfile } from '../profile/schema.js';
import { loadConfig } from '../config/store.js';
import { createEngine } from '../ai/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export function profileRouter() {
  const router = Router();

  router.get('/', (req, res) => res.json(loadProfile()));

  router.post('/', (req, res) => res.json(saveProfile(req.body ?? {})));

  router.post('/import', upload.single('cv'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
      const text = await extractText(req.file.buffer, req.file.originalname);
      if (!text || !text.trim()) {
        return res.status(422).json({ error: 'Could not read any text from that file.' });
      }
      const engine = createEngine(loadConfig());
      const parsed = await parseCvText(text, engine);
      res.json(normalizeProfile(parsed));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
```

- [ ] **Step 4: Mount the router in `server/app.js`**

Add the import near the other imports:
```js
import { profileRouter } from './routes/profile.routes.js';
```
Then, immediately AFTER the `app.post('/api/ai/test', ...)` route and BEFORE the `const webDist = ...` static-serving block, add:
```js
  app.use('/api/profile', profileRouter());
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/api-profile.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all server tests (Phase 1 + Phase 2) green.

- [ ] **Step 7: Commit**

```bash
git add server/routes/profile.routes.js server/app.js server/__tests__/api-profile.test.js
git commit -m "feat: add profile API routes (get/save/import)"
```

---

## Task 5: Front-end API client, router, layout, and Dashboard

**Files:**
- Modify: `web/src/api.ts`, `web/src/App.tsx`, `web/package.json`
- Create: `web/src/components/Layout.tsx`, `web/src/pages/Dashboard.tsx`
- Delete: `web/src/pages/Home.tsx`

- [ ] **Step 1: Add react-router-dom**

Run:
```bash
npm --prefix web install react-router-dom@^6.26.0
```

- [ ] **Step 2: Extend the API client**

Append to `web/src/api.ts` (keep existing exports and the `checkOk` helper):
```ts
export interface Experience { company: string; title: string; startDate: string; endDate: string; description: string; }
export interface Education { institution: string; degree: string; field: string; year: string; }
export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  links: string[];
  updatedAt: string | null;
}

export async function getProfile(): Promise<Profile> {
  const res = await fetch('/api/profile').then(checkOk);
  return res.json();
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
  }).then(checkOk);
  return res.json();
}

export async function importCv(file: File): Promise<Profile> {
  const fd = new FormData();
  fd.append('cv', file);
  const res = await fetch('/api/profile/import', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Create the Layout shell**

`web/src/components/Layout.tsx`:
```tsx
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium ${
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2">
          <span className="font-bold text-slate-800 mr-4">Jobs4UAE Autopilot</span>
          <NavLink to="/" label="Home" />
          <NavLink to="/profile" label="My Profile" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create the Dashboard page**

`web/src/pages/Dashboard.tsx`:
```tsx
import { Link } from 'react-router-dom';
import type { AppConfig } from '../api';

export default function Dashboard({ config }: { config: AppConfig }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">You're all set! 🎉</h1>
      <p className="mt-2 text-slate-600">
        AI is connected using <span className="font-semibold">{config.engine ?? 'unknown'}</span>.
      </p>

      <div className="mt-6 bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-slate-800">Step 1: Set up your profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload your CV and we'll turn it into a profile we can use to score jobs and tailor resumes.
        </p>
        <Link
          to="/profile"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          Go to My Profile →
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Coming next: job evaluation, tailored resumes & cover letters, and GCC job scanning.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Rewire App.tsx with the router**

Delete `web/src/pages/Home.tsx`. Replace `web/src/App.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-red-600">
        Cannot reach the Jobs4UAE Autopilot server. Make sure it is running, then refresh this page.
      </div>
    );
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!config.setupComplete) {
    return <SetupWizard initial={config} onComplete={setConfig} />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard config={config} />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

> Note: `ProfilePage` is created in Task 6. The web build will not compile until then — commit Tasks 5 and 6 together (see Task 6).

- [ ] **Step 6: (Deferred commit)** Proceed directly to Task 6; commit both together there.

---

## Task 6: ProfilePage (upload + editable form + save) and acceptance

**Files:**
- Create: `web/src/pages/ProfilePage.tsx`

- [ ] **Step 1: Implement ProfilePage**

`web/src/pages/ProfilePage.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  saveProfile,
  importCv,
  type Profile,
  type Experience,
  type Education,
} from '../api';

const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm';
const LABEL = 'text-sm font-medium text-slate-700';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setMessage({ ok: false, text: 'Could not load your profile.' }));
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const parsed = await importCv(file);
      setProfile(parsed);
      setMessage({ ok: true, text: 'CV imported! Review the details below, then Save.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setMessage({ ok: true, text: 'Profile saved.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function updateExp(i: number, key: keyof Experience, value: string) {
    if (!profile) return;
    const experience = profile.experience.map((x, idx) => (idx === i ? { ...x, [key]: value } : x));
    set('experience', experience);
  }
  function addExp() {
    if (!profile) return;
    set('experience', [...profile.experience, { company: '', title: '', startDate: '', endDate: '', description: '' }]);
  }
  function removeExp(i: number) {
    if (!profile) return;
    set('experience', profile.experience.filter((_, idx) => idx !== i));
  }

  function updateEdu(i: number, key: keyof Education, value: string) {
    if (!profile) return;
    const education = profile.education.map((x, idx) => (idx === i ? { ...x, [key]: value } : x));
    set('education', education);
  }
  function addEdu() {
    if (!profile) return;
    set('education', [...profile.education, { institution: '', degree: '', field: '', year: '' }]);
  }
  function removeEdu(i: number) {
    if (!profile) return;
    set('education', profile.education.filter((_, idx) => idx !== i));
  }

  if (!profile) {
    return <div className="text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="mt-1 text-slate-600">Upload your CV to fill this in automatically, or type it yourself.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <label className={LABEL}>Import from a CV file (PDF, Word, or text)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={onFile}
          disabled={importing}
          className="mt-2 block text-sm"
        />
        {importing && <p className="mt-2 text-sm text-blue-600">Reading your CV with AI… this can take a few seconds.</p>}
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={LABEL}>Full name</span>
          <input className={FIELD} value={profile.fullName} onChange={(e) => set('fullName', e.target.value)} /></label>
        <label className="block"><span className={LABEL}>Headline / current title</span>
          <input className={FIELD} value={profile.headline} onChange={(e) => set('headline', e.target.value)} /></label>
        <label className="block"><span className={LABEL}>Email</span>
          <input className={FIELD} value={profile.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="block"><span className={LABEL}>Phone</span>
          <input className={FIELD} value={profile.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className={LABEL}>Location</span>
          <input className={FIELD} value={profile.location} onChange={(e) => set('location', e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className={LABEL}>Professional summary</span>
          <textarea className={FIELD} rows={3} value={profile.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className={LABEL}>Skills (comma separated)</span>
          <input
            className={FIELD}
            value={profile.skills.join(', ')}
            onChange={(e) => set('skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          /></label>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Experience</h2>
          <button onClick={addExp} className="text-sm text-blue-600">+ Add</button>
        </div>
        <div className="mt-4 space-y-4">
          {profile.experience.map((x, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Job title" value={x.title} onChange={(e) => updateExp(i, 'title', e.target.value)} />
              <input className={FIELD} placeholder="Company" value={x.company} onChange={(e) => updateExp(i, 'company', e.target.value)} />
              <input className={FIELD} placeholder="Start (e.g. 2021)" value={x.startDate} onChange={(e) => updateExp(i, 'startDate', e.target.value)} />
              <input className={FIELD} placeholder="End (e.g. 2024 or Present)" value={x.endDate} onChange={(e) => updateExp(i, 'endDate', e.target.value)} />
              <textarea className={`${FIELD} sm:col-span-2`} rows={2} placeholder="What you did" value={x.description} onChange={(e) => updateExp(i, 'description', e.target.value)} />
              <button onClick={() => removeExp(i)} className="text-sm text-red-600 justify-self-start">Remove</button>
            </div>
          ))}
          {profile.experience.length === 0 && <p className="text-sm text-slate-400">No experience added yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Education</h2>
          <button onClick={addEdu} className="text-sm text-blue-600">+ Add</button>
        </div>
        <div className="mt-4 space-y-4">
          {profile.education.map((x, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Institution" value={x.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} />
              <input className={FIELD} placeholder="Degree" value={x.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} />
              <input className={FIELD} placeholder="Field" value={x.field} onChange={(e) => updateEdu(i, 'field', e.target.value)} />
              <input className={FIELD} placeholder="Year" value={x.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} />
              <button onClick={() => removeEdu(i)} className="text-sm text-red-600 justify-self-start">Remove</button>
            </div>
          ))}
          {profile.education.length === 0 && <p className="text-sm text-slate-400">No education added yet.</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {profile.updatedAt && <span className="text-xs text-slate-400">Last saved {new Date(profile.updatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to typecheck**

Run: `npm --prefix web run build`
Expected: builds with ZERO TypeScript errors.

- [ ] **Step 3: Commit Tasks 5 + 6 together**

```bash
git add web/package.json web/package-lock.json web/src/api.ts web/src/App.tsx web/src/components/Layout.tsx web/src/pages/Dashboard.tsx web/src/pages/ProfilePage.tsx
git rm web/src/pages/Home.tsx
git commit -m "feat: add profile page, dashboard, layout, and routing"
```

- [ ] **Step 4: Full integration acceptance (manual)**

Build the web app (done) and run the production server path so routing + API are exercised together:
- `NO_OPEN=1 node server/index.js &` then open `http://localhost:5123/`
- You should land on the **Dashboard** (assuming setup is already complete from Phase 1; if not, complete the wizard first).
- Click **My Profile**. Create a small text file `me.txt` with a few lines (name, a job, a skill). Use the file picker to upload it.
- Confirm the AI fills in the fields (requires a working AI engine configured in Phase 1). Edit a field, click **Save profile**, see "Profile saved".
- Refresh the page → the saved values reload (proves `data/profile.json` persistence).
- Stop the server. Remove any test profile: delete `data/profile.json` if you don't want to keep it.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all server tests pass.

---

## Self-Review

**1. Spec coverage (design spec §9 Phase 2):**
- "Upload existing CV (PDF/DOCX) or guided form" → Task 2 (extraction supports pdf/docx/txt), Task 6 (file picker + fully editable form usable without any upload). ✓
- "AI parses the CV into an editable structured profile" → Task 3 (parseCvText), Task 4 (/import route), Task 6 (editable form populated from parse). ✓
- "saved to DB" → stored as `data/profile.json` via Task 1 store (JSON instead of SQLite — deliberate; SQLite arrives with the tracker phase, noted in plan header). ✓
- Acceptance "upload sample CV → parsed fields shown → edit → saved → persists on restart" → Task 6 Step 4. ✓

**2. Placeholder scan:** No TBD/TODO. Every code step is complete. The single forward reference (App.tsx → ProfilePage in Task 5) is flagged and resolved by committing Tasks 5+6 together. ✓

**3. Type consistency:** `Profile`, `Experience`, `Education` defined once in `api.ts` (Task 5) and used consistently in `ProfilePage` (Task 6). Server `EMPTY_PROFILE` keys (Task 1) match the AI prompt's required keys (Task 3) and the front-end `Profile` interface (Task 5): fullName, email, phone, location, headline, summary, skills, experience, education, links, updatedAt. `normalizeProfile` is used in store (Task 1) and the import route (Task 4). Route shape `{ error }` on failure matches `importCv`'s error handling (Task 5). ✓

No issues found.
