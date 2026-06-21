# Phase 13 — Design System + App Shell — Design Spec

**Date:** 2026-06-22
**Status:** Draft — pending user review
**Project:** Jobs4UAE Autopilot
**Source design:** claude.ai/design `jobs4uae-autopilot design` — Lumzi/Cadence system (`_ds/.../colors_and_type.css`), `Jobs4UAE Autopilot.dc.html`, `Jobs4UAE Directions.dc.html`

---

## 1. Summary

Adopt the approved **Lumzi design system** and replace the current top-nav layout with the design's **left-sidebar app-shell**, so the whole app reads as one polished, on-brand product and every later screen has a foundation to build on. This phase is the **bedrock** of the design track (Phases 13–18): it ships the tokens, fonts, light/dark theming, and the shell — existing pages keep working *inside* the new shell and immediately inherit the new typography and palette. Per-page visual re-skins are Phase 14.

## 2. Goals

- Port the Lumzi **design tokens** (colours, type, spacing, radius, elevation, light + dark) into the web app as CSS variables wired into the Tailwind theme.
- Self-host **IBM Plex Sans** (variable) + **IBM Plex Mono** via fontsource.
- **Light/dark** theming via `data-theme` on `<html>` + a persisted toggle (respects `prefers-color-scheme` on first load).
- Build the **sidebar app-shell** (brand + sparkle logo, icon nav with active state, user/engine chip) + a slim topbar (theme toggle + placeholders for future copilot/command-palette) + content area — replacing the current `Layout` (top nav).
- Adopt the design's navigation set; keep every existing route working inside the shell.
- Honour the design's rule: **iris/`--ai-*` is reserved for AI affordances only**; cobalt `--primary-*` is interactive/brand.

## 3. Non-Goals (this phase)

- No per-page visual rebuild (Profile/Documents/Tracker/Scan cards stay as-is for now — that's Phase 14).
- No merging of Evaluate into Scan yet (Phase 14); Evaluate stays a route for now.
- No new features (Copilot, command palette, Home briefing, salary, WhatsApp, mock interview, autonomy) — those are Phases 15–18.
- No real Auto-apply functionality — only a placeholder route/page (Phase 11 builds it).

## 4. Architecture & Components

```
web/src/
  styles/
    tokens.css            # Lumzi CSS variables (light + [data-theme="dark"]) + base body/type
  theme/
    theme.ts              # getTheme()/setTheme()/initTheme() — localStorage + prefers-color-scheme
  components/
    AppShell.tsx          # sidebar + topbar + <main> (replaces Layout)
    Sidebar.tsx           # brand, nav items, user/engine chip
    ThemeToggle.tsx       # light/dark switch
    icons.tsx             # small inline-SVG icon set from the design
  pages/
    AutoApplyPage.tsx     # placeholder "coming soon" (Phase 11 fills it)
  App.tsx                 # MODIFY: wrap routed pages in <AppShell>; add /auto-apply
  main.tsx                # MODIFY: import fontsource + tokens.css; initTheme()
tailwind.config.js        # MODIFY: map tokens to theme (colors/font/radius/shadow)
web/src/components/Layout.tsx  # DELETE (replaced by AppShell)
```

### 4.1 Tokens (`styles/tokens.css`)
A faithful port of `colors_and_type.css`: `:root` light tokens + `[data-theme="dark"]` overrides for `--canvas, --surface, --surface-sunken, --border-subtle, --border, --border-strong, --text-strong, --text, --text-secondary, --text-muted, --primary-* , --ai-*, --success/warning/danger/info (+ -soft/-text), spacing, radius, shadows, focus-ring`. Plus base rules: `body { background: var(--canvas); color: var(--text); font-family: var(--font-sans); }` and the `.t-display/.t-h1/.t-h2/.t-h3/.t-body/.t-data/.t-caption/.t-mono` type utilities.

### 4.2 Tailwind theme (`tailwind.config.js`)
Extend (not replace) the theme so existing default classes still work while token classes become available:
- `colors`: `canvas, surface, 'surface-sunken', 'border-subtle', border, 'border-strong', 'text-strong', text, 'text-secondary', 'text-muted'`, `primary.{50,100,500,600,700,DEFAULT}`, `ai.{50,soft,500,600,700,DEFAULT}`, `success.{DEFAULT,soft,text}`, `warning.{…}`, `danger.{…}`, `info.{…}` — each mapped to its `var(--…)`.
- `fontFamily`: `sans: ['IBM Plex Sans', …]`, `mono: ['IBM Plex Mono', …]`.
- `borderRadius`: `sm:4px, DEFAULT/md:6px, lg:10px, xl:14px`.
- `boxShadow`: `sm/md/lg` from the tokens.

### 4.3 Theme (`theme/theme.ts`)
`initTheme()` (read localStorage `j4u-theme`, else `prefers-color-scheme`, set `document.documentElement.dataset.theme`), `getTheme()`, `setTheme('light'|'dark')` (persist + apply). `main.tsx` calls `initTheme()` before render.

### 4.4 App shell (`AppShell.tsx` + `Sidebar.tsx`)
- **Sidebar** (≈232px, `--surface`, hairline right border): brand "jobs4uae" with the iris sparkle mark; a "Workspace" label; nav items (icon + label, active = `--primary-50` bg + `--primary-700` text), and a bottom user/engine chip (avatar initials + name + active AI engine label read from `/api/config`). Nav set: **Home, My profile, Evaluate Jobs, Documents, Tracker, Find Jobs, Auto-apply**. (Evaluate stays for now; Phase 14 merges it into the Scan hub.)
- **Topbar** (slim, `--surface`, hairline bottom): left = current route title (from a route→title map); right = `ThemeToggle` + inert placeholders for the future copilot/command-palette.
- **Content**: `<main style="background: var(--canvas)">` renders the routed page (max-width container, comfortable padding).
- Icons: inline SVGs in `icons.tsx` lifted from the design (home, user, target, document, bars, search, send/sparkle, sun/moon).

### 4.5 Routing (`App.tsx`)
When `setupComplete`, render `<AppShell><Routes>…</Routes></AppShell>`. Keep existing routes (`/`, `/profile`, `/evaluate`, `/documents`, `/tracker`, `/scan`) and add `/auto-apply` → `AutoApplyPage` (a friendly "coming soon — assisted apply is in the works" placeholder that references the safety model). The Setup Wizard (`!setupComplete`) stays full-screen outside the shell but also gets tokens/fonts.

## 5. Data flow / dependencies

- New deps: `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (self-hosted fonts; no network at runtime).
- The sidebar's engine chip reads the existing `/api/config` (engine name) via the existing `getConfig()`.
- No backend/API changes in this phase.

## 6. Error handling

- Theme: if localStorage is unavailable, fall back to `prefers-color-scheme` and don't throw.
- Engine chip: if `getConfig()` fails, show a neutral "AI" label rather than erroring.

## 7. Testing

- **Build gate:** `npm --prefix web run build` with zero TypeScript errors (the primary automated check; the web app has no unit-test harness, consistent with prior phases).
- **Server tests unaffected:** `npm test` still 144 passing (no server changes).
- **Manual acceptance:** app launches into the new sidebar shell; all 7 nav items route correctly; the active item highlights; the engine chip shows the configured engine; the **theme toggle** flips light/dark and persists across reload; every existing page renders inside the shell with IBM Plex + the Lumzi canvas; the Setup Wizard still works for a fresh setup.

## 8. Success criteria

A user opening the app sees the polished **Lumzi sidebar shell** (brand, icon nav, engine chip), can switch **light/dark**, and navigates all existing pages — now in IBM Plex on the Lumzi canvas — plus a new **Auto-apply** placeholder. The visual language and shell are in place for Phases 14–18 to build the full design on.
