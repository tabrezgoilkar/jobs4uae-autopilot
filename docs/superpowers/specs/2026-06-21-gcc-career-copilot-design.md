# Jobs4UAE Autopilot — Design Spec

**Date:** 2026-06-21
**Status:** Approved (shape) — pending spec review
**Author:** tabrez

---

## 1. Summary

Jobs4UAE Autopilot is a **free, local, non-technical-friendly** job-search assistant for the **GCC region** (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman).

It is an adaptation of the open-source [`santifer/career-ops`](https://github.com/santifer/career-ops) tool. Career-Ops is powerful but built **for developers**: it runs as slash-commands inside a paid AI coding CLI (Claude Code / Gemini CLI), requires Node.js + git + hand-editing YAML config in a terminal, and assumes a paid AI subscription.

This project **keeps the brain** of Career-Ops (the A–F evaluation rubric, CV-tailoring and cover-letter prompts, PDF generation) and **replaces the skin and engine**:

- a friendly clickable **local web app** (opens in the user's normal browser),
- a **free, user-chosen AI engine** (Gemini free tier by default, bring-your-own-key, or fully-local Ollama),
- a **one-click Windows install** that needs no technical skill,
- **GCC-tailored job-board scanning**.

The intended users are **community members job-hunting in the GCC** — not developers. (The name reflects a UAE-first focus, but all six GCC countries are supported.)

## 2. Goals

- Runs entirely on the user's own Windows PC. No server costs. **Not a penny** required.
- A non-technical person can install and use it without touching a terminal or config file.
- Reuses Career-Ops's proven evaluation/tailoring logic rather than reinventing it.
- AI engine is swappable and free: **Gemini free tier (default)**, **BYO key** (Claude/OpenAI/Gemini), or **local Ollama (automated install)**.
- Job scanning is **tailored to GCC** boards.
- Private by default: the user's CV and data stay on their machine (SQLite + local files).

## 3. Non-Goals (v1)

- No hosting / cloud / multi-user backend (it is local-first).
- No Arabic UI in v1 (English only; Arabic is a future enhancement). Document generation is English in v1.
- No mobile app.
- No fully-automated LinkedIn scraping (LinkedIn is an **assisted** flow — see §7).
- No auto-submitting applications to employers (human-in-the-loop; the app prepares, the user submits).

## 4. Users & Top User Stories

1. *As a job seeker*, I install the app, pick a free AI option in a wizard, and I'm ready in minutes.
2. *As a job seeker*, I upload my existing CV and the app understands my profile.
3. *As a job seeker*, I paste a job description and get a clear A–F "should I apply?" score with reasons.
4. *As a job seeker*, I generate a tailored resume + cover letter and download them as PDFs.
5. *As a job seeker*, I scan GCC job boards by role/city/country and evaluate listings in one click.
6. *As a job seeker*, I track every application and its status in one place.

## 5. Architecture

A single local application: a Node.js server that serves a React web UI and exposes a local API. The user double-clicks a launcher; the server boots and opens `http://localhost:<port>` in the default browser.

```
┌─────────────────────────────────────────────────────────────┐
│  Windows PC (everything local)                                │
│                                                               │
│  ┌──────────────┐   HTTP    ┌──────────────────────────────┐ │
│  │  Browser UI  │ <───────> │  Node.js + Express server     │ │
│  │ React+Vite+TW│           │                                │ │
│  └──────────────┘           │  ┌──────────────────────────┐ │ │
│                             │  │ AI Adapter               │ │ │
│                             │  │  ├─ Gemini (free tier)   │ │ │
│                             │  │  ├─ BYO key (OpenAI/...)  │ │ │
│                             │  │  └─ Ollama (local)       │ │ │
│                             │  ├──────────────────────────┤ │ │
│                             │  │ Evaluation engine        │ │ │
│                             │  │  (ported from career-ops)│ │ │
│                             │  ├──────────────────────────┤ │ │
│                             │  │ Document engine (PDF)    │ │ │
│                             │  │  (Playwright/HTML)       │ │ │
│                             │  ├──────────────────────────┤ │ │
│                             │  │ Scanner engine (GCC)     │ │ │
│                             │  │  (Playwright, config-    │ │ │
│                             │  │   driven board defs)     │ │ │
│                             │  └──────────────────────────┘ │ │
│                             │           │                    │ │
│                             │           ▼                    │ │
│                             │   SQLite (jobs, apps, profile) │ │
│                             │   + local files (CVs, PDFs)    │ │
│                             └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Components (each independently testable)

- **Web UI** (`/web`): React + Vite + Tailwind. Friendly, guided, plain-language. Pages: Setup wizard, Profile, Evaluate, Documents, Scan, Tracker.
- **API server** (`/server`): Express. REST endpoints per feature. Owns config, DB, and the engines below.
- **AI Adapter** (`/server/ai`): one interface `generate({system, prompt, schema?})` with three implementations (Gemini, OpenAI-compatible/BYO, Ollama). Handles key validation, retries, and a "test connection" call. UI never knows which engine is active.
- **Evaluation engine** (`/server/evaluate`): ports Career-Ops's evaluation blocks and A–F rubric into structured prompts that run through the AI Adapter and return structured JSON.
- **Document engine** (`/server/documents`): tailored resume + cover-letter generation, HTML templates, Playwright → PDF.
- **Scanner engine** (`/server/scanner`): config-driven GCC board definitions; Playwright fetch + parse → normalized listing objects. Graceful per-board failure.
- **Storage** (`/server/db`): SQLite via a thin data layer. Local files for uploaded CVs and generated PDFs.
- **Config** (`/server/config`): stores chosen AI engine, keys (local file, not committed), and profile pointers.

### 5.2 AI Adapter contract

```
interface AIEngine {
  name: string
  testConnection(): Promise<{ok: boolean, message: string}>
  generate(opts: {system?: string, prompt: string, json?: boolean}): Promise<string>
}
```

- **GeminiEngine** — default; uses Google AI Studio free-tier key. Wizard links to the free key page and validates the pasted key.
- **ByoKeyEngine** — OpenAI-compatible interface (works for OpenAI, and via base-URL for others); user supplies provider + key.
- **OllamaEngine** — talks to local Ollama at `127.0.0.1:11434`. If Ollama/model missing, the app can install/pull it automatically (Phase 10).

## 6. Data Model (SQLite)

- `profile` — one row: structured CV fields (name, summary, skills, experience JSON, etc.) + path to source CV.
- `jobs` — scanned/pasted listings: source board, title, company, location/country, url, raw description, scanned_at.
- `evaluations` — links to a job: grade (A–F), per-dimension scores JSON, reasoning, recommendation, created_at.
- `documents` — generated artifacts: type (resume/cover), linked job, file path, created_at.
- `applications` — tracker: linked job, status enum (`saved`→`applied`→`interview`→`offer`→`rejected`), notes, dates.

## 7. GCC Job Scanning Strategy

Boards are **config-driven** (`scanner/boards/*.json|js`) so they can be fixed/extended without code changes to the engine. Sequenced across phases:

- **Tier 1 (Phase 7):** Bayt.com, Naukrigulf — pan-GCC, public search.
- **Tier 2 (Phase 8):** GulfTalent, Indeed regional (ae/sa/qa), local boards (Tanqeeb, Laimoon, Dubizzle Jobs UAE).
- **LinkedIn (Phase 9):** **assisted** — opens a Playwright browser using the user's own login session; the app reads visible results rather than bypassing anti-bot. No credential storage by the app.

**Honesty constraints (designed-in):** scraping is fragile (anti-bot, ToS, changing HTML). The scanner must: respect polite rate limits, fail gracefully per-board (one broken board never breaks the run), surface clear "couldn't read this board right now" messages, and keep each board's selectors isolated for easy repair. Country/city/keyword are user inputs.

## 8. Free-AI Trade-offs (surfaced to the user in plain language)

- **Gemini free tier:** best quality-for-free, needs internet + a one-time free key, has daily limits.
- **BYO key:** user controls cost/quality; not free unless they already have credits.
- **Local Ollama:** 100% free + private + offline, but needs a decent PC (~8GB+ RAM) and is slower/lower quality.

## 9. The 10-Phase Roadmap

Each phase ships a working, **tested** increment before the next begins. Each has explicit acceptance tests.

### Phase 1 — Foundation + Setup Wizard
- Scaffold app (Express server + React/Vite/Tailwind UI) with a single dev-run command.
- First-run **Setup Wizard**: choose AI engine (Gemini free / BYO key / Local Ollama), enter & validate key, **"Test AI"** button, save config locally.
- **Acceptance:** App launches and opens in browser; wizard saves config; a real "Test AI" call succeeds for the chosen engine; config persists on restart.

### Phase 2 — Profile & Resume Intake
- Onboarding: upload existing CV (PDF/DOCX) **or** guided form. AI parses the CV into an editable structured profile; saved to DB.
- **Acceptance:** Upload a sample CV → parsed fields shown → user edits → saved → persists on restart.

### Phase 3 — Job Evaluation (core loop)
- Paste a job description → AI evaluation → **A–F fit score** across dimensions, plain-language reasons, apply/skip recommendation. Ports Career-Ops rubric.
- **Acceptance:** Paste a sample JD → structured score + readable reasoning rendered; result saved to DB.

### Phase 4 — Resume Tailoring + Cover Letter
- From an evaluation, generate a tailored, ATS-friendly resume + cover letter; editable preview before export.
- **Acceptance:** Generate from an evaluation → edit text → changes reflected and saved.

### Phase 5 — PDF Export
- Render tailored resume + cover letter to polished PDF via HTML templates + Playwright; one-click download.
- **UAE/GCC-style resume template as the default** — a clean, recruiter-friendly layout matching good UAE CV conventions: header with name + contact (optional photo), a **Personal Details** block (nationality, visa/iqama status, notice period, languages, driving licence — the fields GCC recruiters expect), then summary, experience, education, skills. Ship 1–2 alternative templates the user can pick from.
- *Honesty note:* we cannot pixel-replicate an arbitrary uploaded PDF's layout from extracted text; instead we provide a high-quality UAE template modeled on the conventions of the user's preferred format. (Future option: if the original upload is a `.docx`, fill it as a template.)
- **Acceptance:** Click download → valid PDF in the UAE template that visually matches the preview; user can switch template.

### Phase 6 — Application Tracker
- SQLite-backed tracker: save jobs, set statuses (`saved`→`applied`→`interview`→`offer`→`rejected`), notes; board/list view.
- **Acceptance:** Add applications, change statuses → all persist across restart; counts/filters work.

### Phase 7 — GCC Scanning, Tier 1 (Bayt + Naukrigulf)
- Config-driven scanners for Bayt + Naukrigulf by keyword/country/city → normalized listings into the app → one-click "Evaluate".
- **Acceptance:** Run a search → real listings returned and stored → evaluate one end-to-end.

### Phase 8 — GCC Scanning, Tier 2 (GulfTalent + Indeed + local boards) + per-board verification gating
- **Board registry with per-board status** (the user's requirement): each board carries a `status` of `experimental` → `verified` → `production`. The UI only offers **verified/production** boards to end users by default; `experimental` boards are hidden or clearly badged. A board is promoted to `verified` only after it's **live-tested** against the real site. This also retroactively gates the Phase 7 Bayt/Naukrigulf boards (currently `experimental` until live-tuned).
- Foundation for Phases 8–9: a shared **board-status registry + a standard per-board verification harness** so each board is developed and confirmed against the live site independently before going production-live.
- Add GulfTalent, Indeed (ae/sa/qa), Tanqeeb, Laimoon, Dubizzle Jobs. Board defs are pure config for easy extension; each ships `experimental` and is verified individually.
- **Acceptance:** Each board returns results for a sample query; a deliberately-broken board fails gracefully without breaking the run; only `verified`/`production` boards appear to end users.

### Phase 9 — LinkedIn (assisted) + Batch Evaluation
- LinkedIn via user-assisted logged-in browser session (no credential storage). Batch-evaluate many saved/scanned jobs with a progress UI.
- **Acceptance:** Batch run scores multiple jobs with visible progress; LinkedIn assisted flow returns and stores listings.

### Phase 10 — Local LLM Automation + Windows Packaging + Polish
- Automated **Ollama install + model pull** from inside the app (the "make local LLM automated" requirement).
- Windows **one-click installer/launcher** (bundled portable Node + Start shortcut that boots server and opens browser). Onboarding help + community docs. Error-handling/polish pass.
- **Acceptance:** On a clean Windows PC: install → launch → complete the full loop **online (Gemini)** and **offline (Ollama auto-installed)**.

### Phase 11 — Full Automation (planned; user's ideas being captured)
Vision: move beyond "AI assists, user submits" toward a more fully automated end-to-end job-search loop (e.g. continuous scanning → auto-evaluate → auto-tailor → queue for one-click apply, and beyond). Concrete scope to be defined from the user's ideas. Must consciously revisit the human-in-the-loop / no-auto-submit constraints in §3 — any automation of actual submissions is an explicit, deliberate decision, not a default.

**Ideas captured (to be designed/sequenced later):**

1. **Auto-discover & auto-update OpenRouter free models.** When a user stores an OpenRouter API key, the app automatically queries OpenRouter's models endpoint (`GET https://openrouter.ai/api/v1/models`), filters for *currently free* models (zero pricing / `:free`), validates one with a quick test call, and sets it as the active model — no manual model typing. Because free models expire or get rate-limited (e.g. `nex-agi/nex-n2-pro:free` was free only until 2026-06-23), the app re-checks periodically and on failure auto-rotates to another working free model, so the user never has to hand-edit the model again. (Note: this is an onboarding/AI-engine UX win and could reasonably be pulled forward earlier than the rest of Phase 11.)

2. **Auto-rotate on mid-use rate limits.** When any provider returns a 429 (rate-limited) during normal use — not just at setup — the AI adapter silently retries on the next available working free model instead of surfacing an error, keeping the experience uninterrupted for non-technical users.

3. **Built-in provider presets.** First-class "Free (OpenRouter)", "Free (Groq)", and "OpenAI" presets in the setup wizard that pre-fill the base URL and a sensible model, so the user only pastes a key (or, with idea #1, pastes nothing beyond the key). Combined with the auto-discovery above, the OpenRouter path becomes "paste key → done", with no base-URL or model typing.

Assisted Auto-Apply (Connections + autofill + accumulating answer memory + LinkedIn profile sync) is specced separately in `docs/superpowers/specs/2026-06-21-phase-11-assisted-auto-apply-design.md`.

### Phase 4.5 — Fit Score + Skill Gaps on Generated Documents (near-term enhancement)
**Why:** When a user generates a tailored CV (Phase 4), the page currently shows no fit feedback even though Phase 3 already computes a grade + matched/missing skills. Surface it where the CV is created.
- On the Documents page, show, for the job the CV was generated for: a **fit score (A–F mapped to ★ out of 5)** and the **missing skills** list.
- Source: reuse the linked evaluation when generating from one; when generating from a pasted job, run an evaluation of the **tailored** resume against the job so the score reflects the improved CV.
- **Acceptance:** Generating a CV shows a ★/5 score and the missing-skills list beside it.

### Phase 12 — Skill-Gap Learning Resources (planned)
**Why:** Help GCC community users actually close the gaps the evaluation surfaces.
- For each **missing skill** (from an evaluation or a generated CV), show curated links to **free** public learning resources.
- Anti-fabrication: link to reputable free platforms via a **search link for the skill** (e.g. freeCodeCamp, YouTube, Khan Academy, Microsoft Learn, Google for Education, edX/Coursera audit) rather than inventing specific course URLs that may not exist.
- **Acceptance:** Each missing skill shows one-click "Learn this free" links that open a relevant, real search/landing page on a reputable free platform.

## 9b. Design & Polish Track (from the approved Lumzi design)

The user approved a full product design (claude.ai/design project `jobs4uae-autopilot design`, files `Jobs4UAE Autopilot.dc.html` + `Jobs4UAE Directions.dc.html`) built on the **Lumzi/Cadence design system** (IBM Plex Sans/Mono; cobalt primary; **iris reserved for AI affordances only**; hairline-first, light + dark). The design is the full product vision and is folded into the roadmap as the phases below. **Information-architecture changes adopted from the design:** left **sidebar** shell (replaces top nav); **Evaluate merged into the Scan hub** (inline evaluation on a selected listing — no standalone Evaluate route); **Auto-apply** becomes a first-class route; a global **AI Career Copilot**.

- **Phase 13 — Design System + App Shell (foundation; build next).** Port the Lumzi tokens to CSS variables + Tailwind theme; self-host IBM Plex (via fontsource); light/dark via `data-theme` + toggle; build the **sidebar app-shell** (logo, icon nav, user/engine chip) + topbar + content area; replace the current top-nav `Layout`. Existing pages render inside the new shell and inherit the new type/colour immediately. Acceptance: every existing route works inside the new sidebar shell with Lumzi tokens + fonts; dark mode toggles.
- **Phase 14 — Re-skin existing pages** to the Lumzi components (Profile, Documents, Tracker, Scan). Includes **merging Evaluate into the Scan hub** (inline fit verdict on a selected listing) and removing the standalone Evaluate route.
- **Phase 15 — Home dashboard:** morning briefing, pipeline stats, "to review" queue, learning + interview-prep insights, activity/provenance timeline.
- **Phase 16 — AI Career Copilot:** right-side copilot pane + global drawer + command palette ("Ask the UAE market"), with cited reasoning and the "you decide / never applies on your behalf" transparency.
- **Phase 17 — Scan-hub extras:** salary benchmark, WhatsApp pitch, schedule, bulk bar.
- **Phase 18 — Mock interview** practice.
- Cross-cutting: AI-transparency affordances (scored-by-AI badges, "Why this score?", undo/audit) carried throughout, matching the design.

(Design-track phases run alongside the feature phases 8–11; the design foundation (13) is built next per the user's direction.)

## 10. Risks & Mitigations

- **Scraping breakage / ToS** → config-driven boards, graceful failures, assisted LinkedIn, polite rate limits, clear user messaging.
- **Free-tier limits / model quality** → engine choice with honest trade-off explanations; retries; smaller structured prompts.
- **Non-technical install friction** → bundled runtime + one-click launcher; no terminal/config editing required.
- **Privacy** → all data local (SQLite + files); keys stored locally and git-ignored; app never auto-submits applications.

## 11. Success Criteria

- A non-technical GCC job seeker can: install → set up free AI → import CV → evaluate a job → generate tailored PDFs → scan a GCC board → track applications, **without spending money or using a terminal**.
- The repo is public and self-documenting enough for community contributors to add/fix job boards via config.
