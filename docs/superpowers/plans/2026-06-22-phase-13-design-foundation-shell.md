# Phase 13 — Design System + App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Adopt the Lumzi design tokens + IBM Plex fonts + light/dark theming and replace the top-nav `Layout` with the design's sidebar app-shell, so every existing page renders inside the new shell on-brand.

**Architecture:** A `tokens.css` ports the Lumzi CSS variables (light + dark) and base/type styles; `tailwind.config.js` exposes the safe token colors + fonts. A tiny `theme.ts` persists light/dark on `<html data-theme>`. `AppShell` (sidebar + slim topbar + main) replaces `Layout`; existing routes render inside it. Components use inline styles with the CSS vars (matching the design) — no web unit-test runner exists, so each task is build-verified (`npm --prefix web run build`, zero TS errors) + final manual acceptance.

**Tech Stack:** React + Vite + TS + Tailwind; `@fontsource-variable/ibm-plex-sans` + `@fontsource/ibm-plex-mono`; react-router (existing).

---

## File Structure

```
web/src/styles/tokens.css        # CREATE — Lumzi vars (light + dark) + base + type utilities
web/src/theme/theme.ts           # CREATE — getTheme/setTheme/initTheme/applyTheme
web/src/components/icons.tsx      # CREATE — inline-SVG icon set
web/src/components/ThemeToggle.tsx# CREATE — light/dark button
web/src/components/Sidebar.tsx    # CREATE — brand + nav + engine chip
web/src/components/AppShell.tsx   # CREATE — sidebar + topbar + main
web/src/pages/AutoApplyPage.tsx   # CREATE — placeholder route
web/src/main.tsx                  # MODIFY — import fonts + tokens.css + initTheme()
web/tailwind.config.js            # MODIFY — token colors + fonts + radius + shadow
web/src/App.tsx                   # MODIFY — wrap in AppShell, add /auto-apply
web/src/components/Layout.tsx     # DELETE
```

---

## Task 1: Tokens, fonts, Tailwind theme

**Files:**
- Create: `web/src/styles/tokens.css`
- Modify: `web/tailwind.config.js`, `web/src/main.tsx`

- [ ] **Step 1: Install fonts**

Run: `npm --prefix web install @fontsource-variable/ibm-plex-sans @fontsource/ibm-plex-mono`

- [ ] **Step 2: Create `web/src/styles/tokens.css`**

```css
:root {
  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;

  --canvas: #F5F7FA; --surface: #FFFFFF; --surface-sunken: #ECEFF3;
  --border-subtle: #E2E8F0; --border: #CBD5E1; --border-strong: #94A3B8;
  --text-strong: #0F172A; --text: #1E293B; --text-secondary: #475569; --text-muted: #64748B;
  --scrim: rgba(15,23,42,0.45);

  --primary-50: #EFF4FF; --primary-100: #DBE6FE; --primary-500: #3B6FE8;
  --primary-600: #2D5BD6; --primary-700: #1E47B8; --primary-on-dark: #7AA2F7;

  --ai-50: #F2ECFE; --ai-soft: #F2ECFE; --ai-500: #7C5CFC;
  --ai-600: #6B45F0; --ai-700: #5429C7; --ai-on-dark: #9D86FF;

  --success: #16A34A; --success-soft: #E7F6EC; --success-text: #137A38;
  --warning: #D97706; --warning-soft: #FCEFD6; --warning-text: #92560A;
  --danger: #DC2626; --danger-soft: #FBE9E9; --danger-text: #A11212;
  --info: #0E7490; --info-soft: #E0F2F6; --info-text: #0A5A70;

  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px; --radius-xl: 14px; --radius-pill: 9999px;
  --shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
  --shadow-md: 0 4px 12px rgba(15,23,42,0.08);
  --shadow-lg: 0 12px 32px rgba(15,23,42,0.12);
  --focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--primary-500);
}

[data-theme="dark"] {
  --canvas: #0B0F17; --surface: #151B26; --surface-sunken: #0F141D;
  --border-subtle: #1C2532; --border: #232C3A; --border-strong: #33404F;
  --text-strong: #F1F5F9; --text: #E2E8F0; --text-secondary: #A9B4C2; --text-muted: #7E8A9A;
  --scrim: rgba(0,0,0,0.6);
  --primary-600: #2D5BD6; --primary-500: #3B6FE8;
  --ai-600: #6B45F0; --ai-500: #7C5CFC;
  --shadow-sm: 0 1px 0 rgba(255,255,255,0.03);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--canvas);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; border: 3px solid var(--canvas); }

.t-display { font-weight: 600; font-size: 32px; line-height: 40px; letter-spacing: -0.01em; color: var(--text-strong); }
.t-h1 { font-weight: 600; font-size: 24px; line-height: 32px; letter-spacing: -0.005em; color: var(--text-strong); }
.t-h2 { font-weight: 600; font-size: 20px; line-height: 28px; color: var(--text-strong); }
.t-h3 { font-weight: 600; font-size: 16px; line-height: 24px; color: var(--text-strong); }
.t-body { font-size: 14px; line-height: 22px; color: var(--text); }
.t-mono { font-family: var(--font-mono); font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; }
.t-caption { font-weight: 500; font-size: 12px; line-height: 16px; color: var(--text-muted); }

.j4u-nav:hover { background: var(--surface-sunken); }
```

- [ ] **Step 3: Update `web/tailwind.config.js`**

Replace the file with (extends the theme; default classes still work):
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: 'var(--primary-50)', 100: 'var(--primary-100)', 500: 'var(--primary-500)', 600: 'var(--primary-600)', 700: 'var(--primary-700)', DEFAULT: 'var(--primary-600)' },
        ai: { 50: 'var(--ai-50)', soft: 'var(--ai-soft)', 500: 'var(--ai-500)', 600: 'var(--ai-600)', 700: 'var(--ai-700)', DEFAULT: 'var(--ai-600)' },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)', text: 'var(--success-text)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)', text: 'var(--warning-text)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)', text: 'var(--danger-text)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)', text: 'var(--info-text)' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: '10px', xl: '14px' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Update `web/src/main.tsx`**

Replace contents:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import './index.css';
import './styles/tokens.css';
import { initTheme } from './theme/theme';
import App from './App.tsx';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

> Note: `./theme/theme` is created in Task 2 — the build will fail until then. Build verification for this task happens after Task 2.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles/tokens.css web/tailwind.config.js web/src/main.tsx web/package.json web/package-lock.json
git commit -m "feat: add Lumzi design tokens, IBM Plex fonts, Tailwind token theme"
```

---

## Task 2: Theme store + toggle

**Files:**
- Create: `web/src/theme/theme.ts`, `web/src/components/ThemeToggle.tsx`
- (icons used by ThemeToggle come from Task 3; ThemeToggle is wired in Task 3's shell — but create both here)

- [ ] **Step 1: Create `web/src/theme/theme.ts`**

```ts
export type Theme = 'light' | 'dark';
const KEY = 'j4u-theme';

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* localStorage unavailable */
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* matchMedia unavailable */
  }
  return 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

export function initTheme(): void {
  applyTheme(getTheme());
}
```

- [ ] **Step 2: Create `web/src/components/ThemeToggle.tsx`**

```tsx
import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../theme/theme';
import { IconSun, IconMoon } from './icons';

export default function ThemeToggle() {
  const [theme, setT] = useState<Theme>(getTheme());

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setT(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text-secondary)', cursor: 'pointer',
      }}
    >
      {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}
```

> Note: `./icons` is created in Task 3 — build verification happens after Task 3.

- [ ] **Step 3: Commit**

```bash
git add web/src/theme/theme.ts web/src/components/ThemeToggle.tsx
git commit -m "feat: add persisted light/dark theme store + toggle"
```

---

## Task 3: Icons + Sidebar + AppShell

**Files:**
- Create: `web/src/components/icons.tsx`, `web/src/components/Sidebar.tsx`, `web/src/components/AppShell.tsx`

- [ ] **Step 1: Create `web/src/components/icons.tsx`**

```tsx
import type { SVGProps } from 'react';

type P = { size?: number };

function base(size = 18): SVGProps<SVGSVGElement> {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
}

export function IconHome({ size }: P) {
  return (<svg {...base(size)}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>);
}
export function IconUser({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
}
export function IconTarget({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>);
}
export function IconDoc({ size }: P) {
  return (<svg {...base(size)}><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></svg>);
}
export function IconBars({ size }: P) {
  return (<svg {...base(size)}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></svg>);
}
export function IconSearch({ size }: P) {
  return (<svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>);
}
export function IconSend({ size }: P) {
  return (<svg {...base(size)}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>);
}
export function IconSun({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>);
}
export function IconMoon({ size }: P) {
  return (<svg {...base(size)}><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>);
}
export function IconSparkle({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={color} /></svg>);
}
```

- [ ] **Step 2: Create `web/src/components/Sidebar.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom';
import { IconHome, IconUser, IconTarget, IconDoc, IconBars, IconSearch, IconSend, IconSparkle } from './icons';

const NAV = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/profile', label: 'My profile', Icon: IconUser },
  { to: '/evaluate', label: 'Evaluate a job', Icon: IconTarget },
  { to: '/documents', label: 'Documents', Icon: IconDoc },
  { to: '/tracker', label: 'Tracker', Icon: IconBars },
  { to: '/scan', label: 'Find jobs', Icon: IconSearch },
  { to: '/auto-apply', label: 'Auto-apply', Icon: IconSend },
] as const;

export default function Sidebar({ engine }: { engine: string | null }) {
  const { pathname } = useLocation();
  return (
    <aside style={{ width: 232, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 18px', fontWeight: 600, color: 'var(--text-strong)' }}>
        <span style={{ position: 'relative', fontSize: 21, letterSpacing: '-0.015em' }}>
          jobs4uae
          <span style={{ position: 'absolute', left: 11, top: -13 }}><IconSparkle size={13} color="var(--ai-600)" /></span>
        </span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px 8px' }}>Workspace</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, label, Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className="j4u-nav"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                fontSize: 13.5, textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--primary-700)' : 'var(--text-secondary)',
                background: active ? 'var(--primary-50)' : 'transparent',
              }}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>J4</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>Your workspace</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{engine ? `AI · ${engine}` : 'AI'}</div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `web/src/components/AppShell.tsx`**

```tsx
import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

export default function AppShell({ engine, children }: { engine: string | null; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar engine={engine} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
          </div>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build to typecheck (now Tasks 1–3 resolve together)**

Run: `npm --prefix web run build`
Expected: builds with ZERO TypeScript errors. (AppShell isn't used yet — that's Task 4 — but all new modules compile and `main.tsx`'s `initTheme` import resolves.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/icons.tsx web/src/components/Sidebar.tsx web/src/components/AppShell.tsx
git commit -m "feat: add icon set, Lumzi sidebar, and app shell"
```

---

## Task 4: Wire the shell + Auto-apply placeholder + remove old Layout

**Files:**
- Create: `web/src/pages/AutoApplyPage.tsx`
- Modify: `web/src/App.tsx`
- Delete: `web/src/components/Layout.tsx`

- [ ] **Step 1: Create `web/src/pages/AutoApplyPage.tsx`**

```tsx
export default function AutoApplyPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="t-h1">Auto-apply</h1>
      <p className="t-body" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
        Assisted Auto-Apply is on the way. You'll connect your job-board accounts once, then the app will open a
        job, fill the application, and stop at the Submit button for you to review and send.
      </p>
      <div
        style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          color: 'var(--ai-700)', background: 'var(--ai-soft)', border: '1px solid var(--ai-50)',
          borderRadius: 8, padding: '9px 13px',
        }}
      >
        It never applies on your behalf — you always click Submit. No passwords are stored.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `web/src/App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import EvaluatePage from './pages/EvaluatePage';
import DocumentsPage from './pages/DocumentsPage';
import TrackerPage from './pages/TrackerPage';
import ScanPage from './pages/ScanPage';
import AutoApplyPage from './pages/AutoApplyPage';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: 'var(--danger-text)' }}>
        Cannot reach the Jobs4UAE Autopilot server. Make sure it is running, then refresh this page.
      </div>
    );
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (!config.setupComplete) {
    return <SetupWizard initial={config} onComplete={setConfig} />;
  }

  return (
    <BrowserRouter>
      <AppShell engine={config.engine}>
        <Routes>
          <Route path="/" element={<Dashboard config={config} />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/evaluate" element={<EvaluatePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/auto-apply" element={<AutoApplyPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Delete the old Layout**

Run: `git rm web/src/components/Layout.tsx`

- [ ] **Step 4: Build to typecheck**

Run: `npm --prefix web run build`
Expected: ZERO TypeScript errors (no remaining imports of `Layout`).

- [ ] **Step 5: Confirm server tests unaffected**

Run: `npm test`
Expected: 144 passed (no server changes).

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/pages/AutoApplyPage.tsx
git commit -m "feat: render app inside Lumzi shell; add Auto-apply placeholder; remove old Layout"
```

- [ ] **Step 7: Manual acceptance**

- `npm run dev` → open `http://localhost:5173`.
- Confirm: a **left sidebar** (jobs4uae brand + sparkle, 7 nav items, engine chip at the bottom showing the configured engine); a slim topbar with a **theme toggle**.
- Click each nav item — the route loads and the active item highlights (cobalt tint).
- Toggle the theme → the whole app flips **light ↔ dark**; reload → the choice persists.
- Every existing page (Home/Profile/Evaluate/Documents/Tracker/Find jobs) renders inside the shell in **IBM Plex** on the Lumzi canvas; **Auto-apply** shows the placeholder.
- Stop the dev server.

---

## Self-Review

**1. Spec coverage:**
- Tokens → Task 1 (`tokens.css` light+dark+type). ✓
- IBM Plex via fontsource → Task 1 (install + main.tsx import). ✓
- Light/dark + persisted toggle + prefers-color-scheme → Task 2 (`theme.ts`, `ThemeToggle`), Task 1 (`initTheme` in main.tsx). ✓
- Sidebar shell (brand+sparkle, icon nav, active state, engine chip) + slim topbar (theme toggle) → Task 3 (`Sidebar`, `AppShell`). ✓
- Adopt nav set incl. Auto-apply; keep existing routes → Task 4 (App.tsx routes). ✓
- Replace Layout → Task 4 (delete + AppShell). ✓
- Tailwind token theme → Task 1. ✓
- Iris reserved for AI (sparkle uses `--ai-600`; nav active uses `--primary-*`) → Task 3. ✓

**2. Placeholder scan:** No TBD/TODO. The two cross-task forward references (`main.tsx`→`theme.ts` in Task 1; `ThemeToggle`→`icons` in Task 2) are explicitly flagged and resolved by Task 3's build step. Every code step is complete.

**3. Type consistency:** `Theme` type defined in `theme.ts` (Task 2) used by `ThemeToggle` (Task 2). Icon component prop `{ size?: number }` consistent across `icons.tsx` (Task 3) and consumers (`Sidebar`, `ThemeToggle`). `AppShell({ engine, children })` matches its use in `App.tsx` (Task 4) passing `config.engine` (type `EngineId | null` → `string | null`, compatible). `Sidebar({ engine })` matches `AppShell` passing it through. Route paths in `App.tsx` match the `NAV` `to` values in `Sidebar`. ✓

No issues found.
