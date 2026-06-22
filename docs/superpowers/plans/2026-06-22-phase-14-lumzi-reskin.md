# Phase 14 — Lumzi re-skin of all pages + shell chrome

> **For agentic workers:** This is a **visual re-skin** of an already-approved design, not new feature logic. The "test" for each task is: `npm run build` passes (web) + a Playwright screenshot in BOTH light and dark matches the approved design's look. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring every existing page and the app shell up to the approved **Lumzi** design language (already ported as tokens in Phase 13), replacing the leftover generic Tailwind (`bg-white`, `blue-600`, `slate-*`, `rounded-2xl shadow`) with token-based styling that matches `Jobs4UAE Autopilot.dc.html`.

**Architecture:** Extend the Tailwind theme with the remaining Lumzi tokens (surface/canvas/text/border/radius) so pages re-skin with clean utility classes instead of ad-hoc colors. Add a tiny shared UI primitive layer (`Card`, `PageHeader`, `Button`, `Badge`, `GradeBadge`) so pages stop hand-rolling card/button markup. Re-skin each page against its section in the approved design. Add the design's **topbar** (per-route title + subtitle, theme toggle, and visually-present Copilot/⌘K affordances) to `AppShell`, and align the `Sidebar` nav grouping to the design.

**Tech Stack:** React + Vite + TS + Tailwind; Lumzi tokens in `web/src/styles/tokens.css`; design source = claude.ai/design project `be1ada00-42de-4811-9c55-6ad7bc8dece6`, file `Jobs4UAE Autopilot.dc.html` (read via DesignSync MCP).

**Explicitly OUT of scope (later phases):** the rich Home **dashboard** with live pipeline stats + morning briefing (Phase 15), the **AI Copilot** side panel and **⌘K command palette** behaviour (Phase 16 — Phase 14 only renders their entry-point buttons as visually-correct, non-functional affordances), scan extras like salary chips already shipped / WhatsApp channel (Phase 17), mock interview (Phase 18). Real WhatsApp/Telegram **channel** URLs don't exist yet → the topbar's GitHub "Feature/Report" links are real; social-channel buttons are deferred to Phase 17.

**Design fidelity rules (from the design system):**
- Cobalt **primary** (`--primary-*`) for normal actions; **iris** (`--ai-*`) is reserved for AI affordances ONLY (Copilot button, palette, AI-tip cards, "AI" badges).
- Hairline-first: 1px `--border-subtle` borders, `--surface` cards on `--canvas`, radius 12–14px, soft `--shadow-sm`.
- IBM Plex Sans for text, IBM Plex Mono for source/board labels, numbers `tabular-nums`.
- Everything must look correct in **dark mode** (token-driven, so avoid hardcoded hex except where the design itself hardcodes grade/accent tints — prefer tokens, and add dark fallbacks for any literal hex used).

---

## File structure

- Modify `web/tailwind.config.js` — add surface/canvas/text/border color tokens + `borderRadius.pill` + sunken.
- Create `web/src/components/ui/Card.tsx` — surface card (border-subtle, radius-xl, optional header).
- Create `web/src/components/ui/PageHeader.tsx` — h1 + subtitle block used at the top of each page body.
- Create `web/src/components/ui/Button.tsx` — `variant: 'primary' | 'secondary' | 'ai'`, sizes; token-based.
- Create `web/src/components/ui/Badge.tsx` — pill badge with `tone: 'success' | 'warning' | 'danger' | 'primary' | 'ai' | 'neutral'`.
- Create `web/src/components/ui/GradeBadge.tsx` — A–F square/round grade chip with the design's grade tints (A green, B cobalt, C amber, D orange, F red) + dark fallbacks.
- Create `web/src/components/ui/index.ts` — barrel export.
- Create `web/src/components/Topbar.tsx` — sticky topbar: title+sub (per route via a route→meta map), theme toggle, Copilot + ⌘K affordances (iris, non-functional w/ "Coming soon" title).
- Modify `web/src/components/AppShell.tsx` — render `Topbar`; keep centered max-width content.
- Modify `web/src/components/Sidebar.tsx` — match design grouping (Workspace: Home/My profile/Documents/Tracker; "Find & apply": Scan/Auto-apply), keep Evaluate reachable (see Task 9 merge decision).
- Modify each page: `Dashboard.tsx`, `ProfilePage.tsx`, `EvaluatePage.tsx`, `DocumentsPage.tsx`, `TrackerPage.tsx`, `ScanPage.tsx`, `SetupWizard.tsx`, `AutoApplyPage.tsx`.

---

## Task 1: Extend Tailwind tokens

**Files:** Modify `web/tailwind.config.js`

- [ ] **Step 1:** Add to `theme.extend.colors`:
```js
canvas: 'var(--canvas)',
surface: { DEFAULT: 'var(--surface)', sunken: 'var(--surface-sunken)' },
ink: { strong: 'var(--text-strong)', DEFAULT: 'var(--text)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' },
hair: { subtle: 'var(--border-subtle)', DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
```
(Use `ink`/`hair` namespaces to avoid clashing with Tailwind's built-in `text-*`/`border-*` utilities — gives `bg-surface`, `text-ink-strong`, `border-hair-subtle`.)
- [ ] **Step 2:** Add `borderRadius.pill: '9999px'`.
- [ ] **Step 3:** `npm run build` (web) passes.
- [ ] **Step 4:** Commit `feat(web): expose Lumzi surface/ink/hair tokens to Tailwind`.

## Task 2: Shared UI primitives

**Files:** Create the `web/src/components/ui/*` files above.

- [ ] **Step 1:** `Card` — `<div className="bg-surface border border-hair-subtle rounded-xl shadow-sm">` with optional `title` rendering a header row (`px-5 py-4 border-b border-hair-subtle`, `text-ink-strong font-semibold text-sm`) + `padding` toggle for body.
- [ ] **Step 2:** `PageHeader` — `title` (`text-2xl font-bold text-ink-strong tracking-tight`) + optional `subtitle` (`text-ink-secondary mt-1 text-sm`) + optional `action` slot (right-aligned).
- [ ] **Step 3:** `Button` — base `inline-flex items-center gap-2 rounded-lg font-semibold j4u-press`; `primary` = `bg-primary-600 text-white`, `secondary` = `bg-surface border border-hair text-ink-strong`, `ai` = `bg-ai-soft text-ai-700 border border-ai-soft`; sizes `sm` (h-9 px-3 text-xs) / `md` (h-10 px-4 text-sm); `disabled:opacity-50`. Forward `as` for `<a>`/`<Link>` usage (or expose a `ButtonLink`).
- [ ] **Step 4:** `Badge` — `inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold border`, tone→token classes (success/warning/danger use `*-soft`/`*-text`; primary/ai analogous; neutral = `bg-surface-sunken text-ink-secondary border-hair`).
- [ ] **Step 5:** `GradeBadge` — square 46×46 (and a `size="sm"` chip), grade→tint map matching the design (A `success-soft`/`success-text`, B `primary-50`/`primary-700`, C/D amber/orange literals **with `dark:` fallbacks**, F `danger-soft`/`danger-text`).
- [ ] **Step 6:** `index.ts` barrel. `npm run build` passes.
- [ ] **Step 7:** Commit `feat(web): add Lumzi UI primitives (Card/PageHeader/Button/Badge/GradeBadge)`.

## Task 3: Topbar + AppShell

**Files:** Create `Topbar.tsx`; modify `AppShell.tsx`. Design ref: the "topbar" block in `Jobs4UAE Autopilot.dc.html`.

- [ ] **Step 1:** Route→meta map `{ path: { title, sub } }` for `/`, `/profile`, `/evaluate`, `/documents`, `/tracker`, `/scan`, `/auto-apply`; fallback title from the longest matching prefix. Read current route via `useLocation`.
- [ ] **Step 2:** Render sticky topbar: left = `title` (15px/700 `text-ink-strong`) + `sub` (12.5px `text-ink-muted`); right = `ThemeToggle` + an **iris** `⌘K` search affordance + **iris** Copilot button, both `title="Coming soon"` and non-functional (Phase 16). Use `backdrop-blur` + `border-b border-hair-subtle` like the design.
- [ ] **Step 3:** `AppShell` renders `<Topbar/>` instead of the bare header; keep `<main>` scroll + centered max-width (~1040px) content wrapper.
- [ ] **Step 4:** Build passes; Playwright screenshot `/` light+dark — topbar matches design chrome.
- [ ] **Step 5:** Commit `feat(web): design-aligned topbar with per-route title/subtitle`.

## Task 4: Sidebar alignment

**Files:** Modify `Sidebar.tsx`. Design ref: sidebar block.

- [ ] **Step 1:** Reorder/group nav: top group Home, My profile, Documents, Tracker; a `Find & apply` section label; then Scan GCC boards, Auto-apply. (Evaluate handled in Task 9.)
- [ ] **Step 2:** Footer: user/workspace card showing `AI · {engine}` + a green status dot when an engine is set; keep it token-based.
- [ ] **Step 3:** Build; screenshot light+dark; active-route highlight still correct (cobalt `primary-50`/`primary-700`).
- [ ] **Step 4:** Commit `feat(web): align sidebar nav grouping to Lumzi design`.

## Tasks 5–8: Re-skin pages (one commit each)

For EACH page below: replace generic Tailwind with the primitives + tokens, match the design section, then `npm run build` + Playwright screenshot **light and dark**, then commit. Keep all existing behaviour/handlers/props — **only markup/classes change**.

- [ ] **Task 5 — `ProfilePage.tsx`** (design: "My profile" route): `PageHeader` + `Card`s; token forms (inputs `bg-surface border border-hair rounded-lg`, focus ring via `j4u-focus`); buttons via `Button`.
- [ ] **Task 6 — `EvaluatePage.tsx`** (design: evaluate/result): `PageHeader`; paste `Card` with token `textarea` + `Button`; `ResultCard` uses `GradeBadge` + dimension grid in `Card`s + `Badge` for recommendation; recent list in a `Card`.
- [ ] **Task 7 — `DocumentsPage.tsx`**: `PageHeader`; generate/edit/save panels as `Card`s; fit-score ★ + missing-skill learning links styled like the design's skill rows (cobalt pill links, `j4u-press`). Keep download buttons; restyle as `Button`s.
- [ ] **Task 8 — `TrackerPage.tsx` + `ScanPage.tsx`**: Tracker board columns/cards on `surface` with status `Badge`s; Scan form + results list rebuilt with `Card`/`Button`/`Badge` (salary/posted already present), board `status` badge (experimental→amber, verified→success). Two commits (one per page) is fine.

## Task 9: Home (Dashboard) reskin + Evaluate/Scan relationship

**Files:** `Dashboard.tsx`, `Sidebar.tsx`, routes.

- [ ] **Step 1:** Re-skin the CURRENT simple Home (the 3 step cards) to `Card`/`Button`/`PageHeader` with a friendly intro — do NOT build the full Phase 15 dashboard. Add a one-line note that the rich dashboard is coming.
- [ ] **Step 2:** **Evaluate↔Scan merge decision:** keep `/evaluate` as the "paste a job" entry but surface it primarily *from* Scan + Home (a "Paste a job instead" link), per the roadmap's "merge Evaluate into Scan" intent, WITHOUT deleting the working evaluate flow. Remove Evaluate from the top-level sidebar (reachable via Home/Scan), OR keep it — **leave a clear comment**; this is the one reversible structural choice. (Low-risk: keep route, demote in nav.)
- [ ] **Step 3:** Build; screenshot; commit `feat(web): reskin Home + demote Evaluate into Find/Home flow`.

## Task 10: Setup Wizard + Auto-apply placeholder

- [ ] **Step 1:** `SetupWizard.tsx` — reskin to the design's 3-step wizard (progress bars, engine cards, key+test step) using tokens/primitives. Keep all existing setup logic/handlers.
- [ ] **Step 2:** `AutoApplyPage.tsx` — reskin the placeholder to a clean token card describing the assisted-apply vision (Phase 11).
- [ ] **Step 3:** Build; screenshot both; commit.

## Final verification

- [ ] `npm test` (server) still 125 passing (no server changes expected).
- [ ] `npm run build` (web) clean.
- [ ] Playwright pass over every route in light AND dark — capture screenshots, confirm no generic `bg-white`/`blue-600`/`slate-*` left (grep `web/src` for those classes → should be empty/justified).
- [ ] Merge `phase-14-lumzi-reskin` → `main`, push.

## Self-review notes
- Spec coverage: every existing route is re-skinned (Tasks 5–10); shell chrome (Tasks 3–4); token foundation (Tasks 1–2). Deferred items explicitly listed under "OUT of scope".
- Reversible structural choice (Evaluate demotion) is flagged and kept non-destructive.
- Dark-mode is a verification gate on every page task.
