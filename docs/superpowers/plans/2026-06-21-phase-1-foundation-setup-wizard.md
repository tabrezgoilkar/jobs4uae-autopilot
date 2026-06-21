# Phase 1 — Foundation + Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the local web app skeleton and a first-run Setup Wizard that lets a non-technical user pick a free AI engine (Gemini free tier / bring-your-own-key / local Ollama), test the connection live, and save the choice so it persists across restarts.

**Architecture:** A Node.js + Express server exposes a small local JSON API (`/api/config`, `/api/ai/test`) and owns a pluggable **AI Adapter** with three engine implementations behind one interface. Config is stored in a git-ignored `data/config.json`. A React + Vite + Tailwind front-end serves the wizard and talks to the API via a dev proxy. Server logic is TDD'd with Vitest + Supertest; the UI is verified by explicit manual acceptance steps.

**Tech Stack:** Node.js (ESM), Express 4, Vitest + Supertest, native `fetch`; React + Vite + TypeScript + Tailwind CSS v3; `concurrently` + `nodemon` for dev.

---

## File Structure

```
package.json                      # root scripts + server deps + test runner
vitest.config.js                  # server test config
server/
  index.js                        # boots Express, opens browser (prod), listens
  app.js                          # createApp() Express factory (testable, no listen)
  config/
    paths.js                      # resolves data dir + config path (env-overridable)
    store.js                      # DEFAULT_CONFIG, loadConfig(), saveConfig()
  ai/
    index.js                      # createEngine(config) -> picks an engine
    gemini.js                     # createGeminiEngine()
    byok.js                       # createByoKeyEngine() (OpenAI-compatible)
    ollama.js                     # createOllamaEngine() (local)
  __tests__/
    config-store.test.js
    ai-gemini.test.js
    ai-byok.test.js
    ai-ollama.test.js
    api-config.test.js
    api-ai-test.test.js
web/
  vite.config.ts                  # dev server + /api proxy to :5123
  tailwind.config.js              # content globs
  postcss.config.js
  src/
    index.css                     # tailwind directives
    main.tsx
    App.tsx                       # routes between Wizard and Home based on setupComplete
    api.ts                        # getConfig/saveConfig/testAI fetch helpers
    pages/SetupWizard.tsx         # the wizard UI
    pages/Home.tsx                # simple post-setup landing
```

Ports: **server = 5123**, **web dev = 5173** (Vite proxies `/api` → 5123).

---

## Task 1: Repo scaffold, root tooling, and a passing test runner

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `server/__tests__/smoke.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `vitest` is not installed / `package.json` missing.

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "jobs4uae-autopilot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "concurrently -k -n server,web -c blue,green \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server": "cross-env NO_OPEN=1 nodemon server/index.js",
    "dev:web": "npm --prefix web run dev",
    "build": "npm --prefix web run build",
    "start": "node server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "cross-env": "^7.0.3",
    "nodemon": "^3.1.0",
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

`vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Install and run tests**

Run: `npm install && npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.js server/__tests__/smoke.test.js package-lock.json
git commit -m "chore: scaffold root tooling and vitest runner"
```

---

## Task 2: Config store (defaults + persistence)

**Files:**
- Create: `server/config/paths.js`
- Create: `server/config/store.js`
- Test: `server/__tests__/config-store.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/config-store.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmp;
});

describe('config store', () => {
  it('returns defaults when no config file exists', async () => {
    const { loadConfig } = await import('../config/store.js');
    const cfg = loadConfig();
    expect(cfg.engine).toBe(null);
    expect(cfg.setupComplete).toBe(false);
    expect(cfg.gemini.model).toBe('gemini-2.0-flash');
  });

  it('persists saved config to disk', async () => {
    const { saveConfig, loadConfig } = await import('../config/store.js');
    saveConfig({ engine: 'gemini', gemini: { apiKey: 'k', model: 'gemini-2.0-flash' }, setupComplete: true });
    const cfg = loadConfig();
    expect(cfg.engine).toBe('gemini');
    expect(cfg.gemini.apiKey).toBe('k');
    expect(cfg.setupComplete).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/config-store.test.js`
Expected: FAIL — cannot find `../config/store.js`.

- [ ] **Step 3: Write minimal implementation**

`server/config/paths.js`:
```js
import path from 'node:path';
import fs from 'node:fs';

export function dataDir() {
  const override = process.env.JOBS4UAE_DATA_DIR;
  const dir = override || path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function configPath() {
  return path.join(dataDir(), 'config.json');
}
```

`server/config/store.js`:
```js
import fs from 'node:fs';
import { configPath } from './paths.js';

export const DEFAULT_CONFIG = {
  engine: null, // 'gemini' | 'byok' | 'ollama'
  gemini: { apiKey: '', model: 'gemini-2.0-flash' },
  byok: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
  setupComplete: false,
};

export function loadConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...structuredClone(DEFAULT_CONFIG), ...raw };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/config-store.test.js`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add server/config/ server/__tests__/config-store.test.js
git commit -m "feat: add config store with defaults and persistence"
```

---

## Task 3: Gemini engine (default free tier)

**Files:**
- Create: `server/ai/gemini.js`
- Test: `server/__tests__/ai-gemini.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/ai-gemini.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGeminiEngine } from '../ai/gemini.js';

afterEach(() => vi.unstubAllGlobals());

describe('gemini engine', () => {
  it('reports not-ok when no API key is set', async () => {
    const engine = createGeminiEngine({ apiKey: '' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the API responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
    })));
    const engine = createGeminiEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });

  it('reports not-ok on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'bad key' })));
    const engine = createGeminiEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/ai-gemini.test.js`
Expected: FAIL — cannot find `../ai/gemini.js`.

- [ ] **Step 3: Write minimal implementation**

`server/ai/gemini.js`:
```js
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiEngine({ apiKey = '', model = 'gemini-2.0-flash' } = {}) {
  async function generate({ system, prompt }) {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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

  return { name: 'gemini', testConnection, generate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/ai-gemini.test.js`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add server/ai/gemini.js server/__tests__/ai-gemini.test.js
git commit -m "feat: add Gemini AI engine"
```

---

## Task 4: Bring-your-own-key engine (OpenAI-compatible)

**Files:**
- Create: `server/ai/byok.js`
- Test: `server/__tests__/ai-byok.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/ai-byok.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createByoKeyEngine } from '../ai/byok.js';

afterEach(() => vi.unstubAllGlobals());

describe('byok engine', () => {
  it('reports not-ok without a key', async () => {
    const engine = createByoKeyEngine({ apiKey: '' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the API responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
    })));
    const engine = createByoKeyEngine({ apiKey: 'x' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/ai-byok.test.js`
Expected: FAIL — cannot find `../ai/byok.js`.

- [ ] **Step 3: Write minimal implementation**

`server/ai/byok.js`:
```js
export function createByoKeyEngine({
  baseUrl = 'https://api.openai.com/v1',
  apiKey = '',
  model = 'gpt-4o-mini',
} = {}) {
  async function generate({ system, prompt }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async function testConnection() {
    if (!apiKey) return { ok: false, message: 'No API key provided.' };
    try {
      await generate({ prompt: 'Reply with the single word: OK' });
      return { ok: true, message: `Connected to ${model}.` };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return { name: 'byok', testConnection, generate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/ai-byok.test.js`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add server/ai/byok.js server/__tests__/ai-byok.test.js
git commit -m "feat: add bring-your-own-key (OpenAI-compatible) engine"
```

---

## Task 5: Local Ollama engine

**Files:**
- Create: `server/ai/ollama.js`
- Test: `server/__tests__/ai-ollama.test.js`

- [ ] **Step 1: Write the failing test**

`server/__tests__/ai-ollama.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOllamaEngine } from '../ai/ollama.js';

afterEach(() => vi.unstubAllGlobals());

describe('ollama engine', () => {
  it('reports not-ok when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });

  it('reports ok when the model is installed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:latest' }] }),
    })));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(true);
  });

  it('reports not-ok when running but model is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'mistral:latest' }] }),
    })));
    const engine = createOllamaEngine({ model: 'llama3.2' });
    const r = await engine.testConnection();
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/ai-ollama.test.js`
Expected: FAIL — cannot find `../ai/ollama.js`.

- [ ] **Step 3: Write minimal implementation**

`server/ai/ollama.js`:
```js
export function createOllamaEngine({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'llama3.2',
} = {}) {
  async function generate({ system, prompt }) {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, system, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.response ?? '';
  }

  async function testConnection() {
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const names = (data?.models ?? []).map((m) => m.name);
      const installed = names.some((n) => n === model || n.startsWith(model + ':'));
      return installed
        ? { ok: true, message: `Ollama running; model "${model}" is installed.` }
        : { ok: false, message: `Ollama is running but model "${model}" is not installed yet.` };
    } catch {
      return { ok: false, message: `Could not reach Ollama at ${baseUrl}. Is it installed and running?` };
    }
  }

  return { name: 'ollama', testConnection, generate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/ai-ollama.test.js`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add server/ai/ollama.js server/__tests__/ai-ollama.test.js
git commit -m "feat: add local Ollama engine"
```

---

## Task 6: Engine factory + Express app with config and AI-test routes

**Files:**
- Create: `server/ai/index.js`
- Create: `server/app.js`
- Test: `server/__tests__/api-config.test.js`
- Test: `server/__tests__/api-ai-test.test.js`

- [ ] **Step 1: Write the failing tests**

`server/__tests__/api-config.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../app.js';

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'j4u-'));
  process.env.JOBS4UAE_DATA_DIR = tmp;
});

describe('config API', () => {
  it('GET /api/config returns defaults', async () => {
    const res = await request(createApp()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.setupComplete).toBe(false);
  });

  it('POST /api/config saves and is reflected on GET', async () => {
    const app = createApp();
    await request(app).post('/api/config').send({ engine: 'gemini', setupComplete: true });
    const res = await request(app).get('/api/config');
    expect(res.body.engine).toBe('gemini');
    expect(res.body.setupComplete).toBe(true);
  });
});
```

`server/__tests__/api-ai-test.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

afterEach(() => vi.unstubAllGlobals());

describe('AI test API', () => {
  it('POST /api/ai/test returns ok for a working engine', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
    })));
    const res = await request(createApp())
      .post('/api/ai/test')
      .send({ engine: 'gemini', gemini: { apiKey: 'x' } });
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/ai/test returns 400 for an unknown engine', async () => {
    const res = await request(createApp()).post('/api/ai/test').send({ engine: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/api-config.test.js server/__tests__/api-ai-test.test.js`
Expected: FAIL — cannot find `../app.js`.

- [ ] **Step 3: Write minimal implementation**

`server/ai/index.js`:
```js
import { createGeminiEngine } from './gemini.js';
import { createByoKeyEngine } from './byok.js';
import { createOllamaEngine } from './ollama.js';

export function createEngine(config) {
  switch (config?.engine) {
    case 'gemini':
      return createGeminiEngine(config.gemini ?? {});
    case 'byok':
      return createByoKeyEngine(config.byok ?? {});
    case 'ollama':
      return createOllamaEngine(config.ollama ?? {});
    default:
      throw new Error(`Unknown or unset AI engine: ${config?.engine}`);
  }
}
```

`server/app.js`:
```js
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from './config/store.js';
import { createEngine } from './ai/index.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.get('/api/config', (req, res) => {
    res.json(loadConfig());
  });

  app.post('/api/config', (req, res) => {
    res.json(saveConfig(req.body ?? {}));
  });

  app.post('/api/ai/test', async (req, res) => {
    try {
      const engine = createEngine(req.body ?? {});
      res.json(await engine.testConnection());
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  });

  // In production, serve the built web app if it exists.
  const webDist = path.resolve(process.cwd(), 'web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — all server tests pass (smoke, config-store, ai-gemini, ai-byok, ai-ollama, api-config, api-ai-test).

- [ ] **Step 5: Commit**

```bash
git add server/ai/index.js server/app.js server/__tests__/api-config.test.js server/__tests__/api-ai-test.test.js
git commit -m "feat: add engine factory and config/ai-test API routes"
```

---

## Task 7: Server entry point (listen + open browser)

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Write the implementation**

`server/index.js`:
```js
import { createApp } from './app.js';
import open from 'open';

const PORT = process.env.PORT || 5123;
const app = createApp();

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Jobs4UAE Autopilot server running at ${url}`);
  if (process.env.NODE_ENV !== 'test' && process.env.NO_OPEN !== '1') {
    open(url).catch(() => {});
  }
});
```

- [ ] **Step 2: Smoke-test the server**

Run: `NO_OPEN=1 node server/index.js` (Windows PowerShell: `$env:NO_OPEN=1; node server/index.js`)
Then in another terminal: `curl http://localhost:5123/api/health`
Expected: server logs the running URL; curl returns `{"ok":true}`. Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add server entry point with browser auto-open"
```

---

## Task 8: Web app scaffold (Vite + React + TS + Tailwind)

**Files:**
- Create: `web/` (via Vite) and Tailwind config files
- Modify: `web/vite.config.ts`, `web/src/index.css`, `web/src/main.tsx`

- [ ] **Step 1: Scaffold Vite app**

Run: `npm create vite@latest web -- --template react-ts`
Then: `npm --prefix web install`

- [ ] **Step 2: Add Tailwind CSS v3**

Run:
```bash
npm --prefix web install -D tailwindcss@^3 postcss autoprefixer
npm --prefix web exec tailwindcss init -p
```

`web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`web/src/index.css` (replace contents):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Ensure `web/src/main.tsx` imports it (Vite's template already has `import './index.css'`).

- [ ] **Step 3: Configure the dev proxy**

`web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://localhost:5123',
    },
  },
});
```

- [ ] **Step 4: Verify the web dev server boots**

Run: `npm --prefix web run dev`
Expected: Vite serves at `http://localhost:5173` and opens a browser showing the default Vite + React page. Stop it (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: scaffold Vite + React + TS + Tailwind web app with /api proxy"
```

---

## Task 9: API client + App shell (route between Wizard and Home)

**Files:**
- Create: `web/src/api.ts`
- Create: `web/src/pages/Home.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write the API client**

`web/src/api.ts`:
```ts
export type EngineId = 'gemini' | 'byok' | 'ollama';

export interface AppConfig {
  engine: EngineId | null;
  gemini: { apiKey: string; model: string };
  byok: { baseUrl: string; apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
  setupComplete: boolean;
}

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config');
  return res.json();
}

export async function saveConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(partial),
  });
  return res.json();
}

export async function testAI(body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/ai/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

- [ ] **Step 2: Write the Home placeholder**

`web/src/pages/Home.tsx`:
```tsx
import type { AppConfig } from '../api';

export default function Home({ config }: { config: AppConfig }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">You're all set! 🎉</h1>
        <p className="mt-3 text-slate-600">
          Jobs4UAE Autopilot is connected using{' '}
          <span className="font-semibold">{config.engine}</span>.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          More features arrive in the next phases (import CV, evaluate jobs, scan GCC boards).
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire App.tsx to choose Wizard vs Home**

`web/src/App.tsx` (replace contents):
```tsx
import { useEffect, useState } from 'react';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import Home from './pages/Home';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }

  return config.setupComplete ? (
    <Home config={config} />
  ) : (
    <SetupWizard initial={config} onComplete={setConfig} />
  );
}
```

> Note: `SetupWizard` is created in Task 10. The web app will not compile until then — that is expected; commit App shell and Wizard together in Task 10.

- [ ] **Step 4: Commit (deferred)**

Do not commit yet — `SetupWizard` is added in Task 10. Proceed directly to Task 10.

---

## Task 10: Setup Wizard UI + full first-run acceptance

**Files:**
- Create: `web/src/pages/SetupWizard.tsx`

- [ ] **Step 1: Write the Setup Wizard**

`web/src/pages/SetupWizard.tsx`:
```tsx
import { useState } from 'react';
import { saveConfig, testAI, type AppConfig, type EngineId } from '../api';

const ENGINES: { id: EngineId; title: string; blurb: string }[] = [
  { id: 'gemini', title: 'Gemini (free)', blurb: 'Best quality for free. Needs internet + a free Google key.' },
  { id: 'byok', title: 'My own key', blurb: 'Use your own Claude / OpenAI / Gemini key.' },
  { id: 'ollama', title: 'Local AI (offline)', blurb: '100% private & offline. Needs a decent PC.' },
];

export default function SetupWizard({
  initial,
  onComplete,
}: {
  initial: AppConfig;
  onComplete: (c: AppConfig) => void;
}) {
  const [cfg, setCfg] = useState<AppConfig>(initial);
  const [engine, setEngine] = useState<EngineId>(initial.engine ?? 'gemini');
  const [status, setStatus] = useState<{ ok?: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function engineBody(): Record<string, unknown> {
    return { engine, gemini: cfg.gemini, byok: cfg.byok, ollama: cfg.ollama };
  }

  async function onTest() {
    setBusy(true);
    setStatus(null);
    const r = await testAI(engineBody());
    setStatus(r);
    setBusy(false);
  }

  async function onSave() {
    setBusy(true);
    const saved = await saveConfig({ ...engineBody(), setupComplete: true } as Partial<AppConfig>);
    setBusy(false);
    onComplete(saved);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-slate-800">Welcome to Jobs4UAE Autopilot</h1>
        <p className="mt-2 text-slate-600">Choose how you want the AI to work. All options are free.</p>

        <div className="mt-6 grid gap-3">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEngine(e.id); setStatus(null); }}
              className={`text-left p-4 rounded-xl border-2 transition ${
                engine === e.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-semibold text-slate-800">{e.title}</div>
              <div className="text-sm text-slate-500">{e.blurb}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {engine === 'gemini' && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Gemini API key</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={cfg.gemini.apiKey}
                onChange={(ev) => setCfg({ ...cfg, gemini: { ...cfg.gemini, apiKey: ev.target.value } })}
                placeholder="Paste your free key from aistudio.google.com"
              />
            </label>
          )}
          {engine === 'byok' && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">API base URL</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.baseUrl}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, baseUrl: ev.target.value } })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">API key</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.apiKey}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, apiKey: ev.target.value } })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Model</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.model}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, model: ev.target.value } })}
                />
              </label>
            </>
          )}
          {engine === 'ollama' && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Local model name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={cfg.ollama.model}
                onChange={(ev) => setCfg({ ...cfg, ollama: { ...cfg.ollama, model: ev.target.value } })}
              />
              <span className="text-xs text-slate-400">
                Automated install comes in a later phase. For now, install Ollama and run this model yourself.
              </span>
            </label>
          )}
        </div>

        {status && (
          <div className={`mt-4 text-sm rounded-lg p-3 ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {status.message}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onTest}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
          >
            {busy ? 'Testing…' : 'Test AI'}
          </button>
          <button
            onClick={onSave}
            disabled={busy || !status?.ok}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            Save & continue
          </button>
        </div>
        {!status?.ok && (
          <p className="mt-2 text-xs text-slate-400">Run “Test AI” successfully to enable Save.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit the front-end (App shell + Wizard + Home + api)**

```bash
git add web/src/App.tsx web/src/api.ts web/src/pages/Home.tsx web/src/pages/SetupWizard.tsx
git commit -m "feat: add setup wizard, home, and API client"
```

- [ ] **Step 3: Full first-run manual acceptance**

Start the full dev environment from the repo root: `npm run dev`
This runs the server (port 5123) and the web app (port 5173, which auto-opens).

Verify the **Phase 1 acceptance criteria**:
1. **App launches and opens in browser** — the wizard appears at `http://localhost:5173`.
2. **Choose an engine and test it:**
   - *Gemini path:* paste a real free key from https://aistudio.google.com/app/apikey → click **Test AI** → green "Connected to Gemini" message.
   - *(Optional) Ollama path:* with Ollama running and the model pulled → **Test AI** → green "model is installed".
3. **Save persists** — click **Save & continue** → the Home "You're all set!" screen appears.
4. **Config persists across restart** — stop `npm run dev`, restart it. The app now opens directly on **Home** (not the wizard), confirming `data/config.json` was saved and `setupComplete` is `true`.
5. Confirm `data/config.json` exists and is git-ignored (`git status` shows it untracked/ignored).

- [ ] **Step 4: Update README dev instructions and commit**

Add a "Run it locally (developers)" section to `README.md`:
```markdown
## Run it locally (developers)

```bash
npm install
npm run dev   # starts the server (:5123) and the web app (:5173, opens automatically)
```

Run the tests:
```bash
npm test
```
```

```bash
git add README.md
git commit -m "docs: add local dev instructions"
```

---

## Self-Review

**1. Spec coverage (Phase 1 of design spec §9):**
- "Scaffold app (Express + React/Vite/Tailwind) with a single dev-run command" → Tasks 1, 7, 8 (`npm run dev`). ✓
- "Setup wizard: choose engine (Gemini / BYO key / Local Ollama)" → Task 10 (three engine cards). ✓
- "enter & validate key, Test AI button" → Tasks 3–6 (engines + `/api/ai/test`), Task 10 (Test AI button). ✓
- "save config locally" → Task 2 (store), Task 6 (POST /api/config), Task 10 (Save). ✓
- Acceptance "real Test AI call succeeds" → Task 10 Step 3 (live Gemini/Ollama test). ✓
- Acceptance "config persists on restart" → Task 10 Step 3, item 4. ✓

**2. Placeholder scan:** No TBD/TODO. Every code step contains complete, runnable code. The one cross-task forward reference (App.tsx → SetupWizard in Task 9) is explicitly flagged and resolved in Task 10. ✓

**3. Type consistency:** `AppConfig`, `EngineId`, `getConfig`/`saveConfig`/`testAI` are defined in Task 9 `api.ts` and used identically in Tasks 9–10. Engine factory keys (`gemini`/`byok`/`ollama`) match config sub-objects in `DEFAULT_CONFIG` (Task 2), the factory (Task 6), and the wizard body (Task 10). The `{ ok, message }` shape returned by every engine's `testConnection` matches the API route and the wizard's `status` state. ✓

No issues found.
