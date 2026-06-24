# Jobs4UAE Autopilot — build status

_Last updated: 2026-06-24_

A free, **local-first** job-search copilot for the GCC (UAE, Saudi, Qatar, Kuwait, Bahrain, Oman).
Runs entirely on the user's PC — Node/Express server (port 5123) + Vite/React app. **No cloud deploy**
(privacy by design: CV, answers and API keys never leave the machine). Not on Vercel.

## Done & on `main`

**Core pipeline**
- Setup wizard + AI engine (Gemini / OpenRouter / Local Ollama) with **OpenRouter free-model auto-fallback** (auto-discovers & rotates working free models; self-heals when a `:free` model is retired).
- My Profile — CV import (AI) → editable profile, now incl. **Projects / Certifications / Languages / Awards** + a **Profile copilot** rail (strength gauge + suggestions). **LinkedIn import** live (bookmarklet → Voyager JSON → merge; see below).
- Evaluate — honest A–F fit score with dimensions, matched/missing skills.
- Documents — tabbed **Tailored CV / Cover letter**, rendered preview (marked + DOMPurify) ↔ edit, **fit-after-tailoring gauge**, "still worth adding" skills + free-learn links, PDF download, regenerate.
- PDF export — UAE-style resume/cover (Playwright render).
- Tracker — saved → applied → interview → offer → rejected.

**Find & apply**
- **Scan** — Indeed board (real, live-verified; headed browser + embedded-JSON parse). Rebuilt as the design's 2-column **fit-&-tailor workspace**: ranked job list + sticky Copilot panel (fit dial, dimension-by-dimension, worth-strengthening, "Tailor my CV for this job").
- **Auto-apply — assisted apply live (Indeed)**: Connect → autofill (contact + CV PDF + cover letter + remembered answers) → answer new questions once → user reviews & submits. Backend + UI done; see Phase 11 below.

**Design system & shell (Lumzi)**
- Tokens (cobalt primary, iris AI accents, hairline-first, IBM Plex), light + dark.
- Sidebar + topbar (per-route title, theme toggle), **AI Copilot panel (⌘J)** + **⌘K command palette** ("Ask the UAE job market").
- **Home dashboard** — animated pipeline donut, fit gauge, fit-trend sparkline, briefing, skill-gap insights, recent-activity timeline (all real data).
- **Settings page** — change AI engine/model/key in-app, application-details memory, privacy, GitHub feedback links.
- Bespoke, zero-dependency, token-themed SVG **chart primitives** (RadialGauge / Donut / Sparkline) + eased count-ups.

**Quality:** 258 tests passing (server + web utils); web builds clean; eslint clean.

## 2026-06-24 — Cloud SaaS Phase A: auth foundation started (on `main`)
Decision: take the app online as a **multi-user product** (option B), AI model **3** (hybrid),
**without losing any feature** — so it's a **hybrid**: cloud hosts UI/auth/data/AI; a later desktop
companion runs the headed-browser features (Scan/Assisted Auto-Apply). Spec:
`2026-06-24-cloud-saas-phase-a-foundation-design.md`. Phase 2 online scope (per owner): **Profile +
CV (import → tailored CV/Documents) first**; rest later.
- **Authentication foundation done + tested (slices A1–A3):**
  - `server/storage/kv.js` — per-user JSON storage adapter (`getJson/setJson`); `local` stays flat
    (back-compatible local dev), real users namespace under `data/u/<userId>/`. Postgres impl drops
    in behind the same interface at deploy.
  - Profile + documents stores refactored to per-user; `req.userId` threaded through every route.
  - `server/auth/middleware.js` — sets `req.userId`: Clerk bearer-token verify when
    `CLERK_SECRET_KEY` is set, else `local` (no login needed on the owner's PC). 15 tests.
- **Remaining for Phase A:** A4 Vercel packaging + provision Neon Postgres + Clerk; A5 Clerk login
  screens (frontend). Both need the owner's Vercel + Clerk accounts (in progress).

## 2026-06-24 — Assisted Auto-Apply v1 (Indeed) — backend + UI (on `main`)
Phase 11 v1 built to spec (`2026-06-21-phase-11-assisted-auto-apply-design.md`), **assisted, never automated** — the app prepares & autofills; the **user clicks Submit**. No passwords stored, no CAPTCHA defeat, no fabricated facts, no unattended submit.
- **Application Details store** (`server/apply/answers/store.js`) — standard GCC answers (nationality, visa, notice, current/expected salary, relocate, licence, languages) + an **accumulating Q&A memory** (upsert by normalized question key → asked once, reused forever). `GET/POST /api/application-details`.
- **AI answer-matcher** (`apply/match.js`) — maps a form question to a stored field/memory answer (exact memory short-circuits the AI), **drafts** open-ended free-text from the real profile, or **asks** — and **never invents** a factual answer.
- **Indeed board config + autofiller** (`apply/boards/indeed.js`, `apply/autofill.js`) — config-driven field map; fills contact fields + **resume PDF** + **cover letter** + known/draftable screening answers, returns the rest as pending, **never calls submit** (unit-tested via a fake page adapter).
- **Headed persistent browser** (`apply/browser.js`) — per-board `launchPersistentContext` (session only, never passwords); real page adapter (manual-verify, like the scanner).
- **Connections + apply API** — `GET /api/connections`, `connect`/`confirm`/`disconnect`; `POST /api/apply/start` (open job → autofill → `{ filledCount, pending }`) + `POST /api/apply/answer` (fill into the live form, remember, return remaining). **No submit route.**
- **Auto-apply page wired** — Connect Indeed → "I've logged in" → Connected; Apply workspace (paste job URL → Open & autofill → answer-new-questions panel with AI drafts → "review the form & Submit yourself"); inline Application Details editor (seeded from Settings answers).
- **Email-Apply** (`apply/email/compose.js` + `POST /api/apply/email/compose` + UI section) — for the GCC "send your CV to hr@…" post-jobs (no form, fully legitimate). Paste a post → pulls the recruiter email → AI-drafts a tailored subject+body from the **real** profile (anti-fabrication) → review/edit → **Open in Gmail / mail app** (no credentials, no auto-send) + attach CV from Documents. Discovery via LinkedIn deferred; works from any pasted post.
- 51 new tests. **Live Indeed connect + one real assisted application are verifiable only on the user's machine** (selectors/login are inherently manual, like scanning); all orchestration/store/matcher/email/routes are unit-tested.

## 2026-06-24 — LinkedIn profile sync + Documents word-diff (on `main`)
- **LinkedIn import (Phase 9, partial)** — pull your **own** LinkedIn profile into My Profile, Rezi-style, **local-first**:
  - A self-contained **"Send to Jobs4UAE" bookmarklet** runs in your logged-in LinkedIn tab and calls LinkedIn's own **Voyager API** (no public-page scraping, which is auth-walled/blocked). It auto-imports to the local app, or — if LinkedIn's CSP blocks the POST — downloads `linkedin-profile.json` to upload. Served at `GET /linkedin` (install page) + `GET /api/profile/linkedin/bookmarklet`.
  - Server: `linkedinToProfile()` (tolerant Voyager **or** JSON Resume mapper) → `mergeProfile()` (fills only blank fields, appends new roles/skills/certs by key, returns a change summary — **never overwrites your edits**) → `POST /api/profile/linkedin/import` (returns `{ merged, changes }`, doesn't persist). CORS scoped to `linkedin.com`; in-memory take-once pending hand-off.
  - Web: **My Profile → Import from LinkedIn** modal — drag-the-bookmarklet + file/paste fallback, polls for the bookmarklet hand-off, **review screen** (what gets merged) → Apply into the editable profile → existing Save.
  - 34 new tests. **Live Voyager extraction is verifiable only on the user's machine** with their LinkedIn session (same posture as assisted-apply); map/merge/route/bookmarklet are fully unit-tested.
  - Spec: `docs/superpowers/specs/2026-06-24-linkedin-profile-sync-design.md`. **Phase 9b** = polished Chrome extension wrapping the same import endpoint.
- **Documents — word-level "what changed":** replaced the line file-diff with a section-aware, token-level (LCS) inline diff on the tailored CV.

## 2026-06-23 — product-quality + design-fidelity pass (on `main`)
- **Design system locked to spec:** every block re-aligned to the Lumzi **6px (`md`) radius** ("enterprise-precise, not rounded-toy") app-wide — cards/controls 6px, hairline borders, sparing elevation. Tracker rebuilt to parity then corrected to the canonical block treatment.
- **Documents — "what changed" diff:** deterministic profile→CV baseline + line-diff view (added/removed) on the tailored CV.
- **Scan hub upgrades:** results now **persist across navigation** (session store) incl. the copilot's prior evaluation; **manual "paste a job"** mode (Evaluate merged into Scan); **multi-select + batch scoring** with progress.
- **Documents:** "Tailor my CV" now **auto-runs** tailoring (no dropdown).
- **Profile strength** now honest — counts all sections (projects/certs/languages/awards), with gap suggestions.
- **Auto-apply page** built to design — **Indeed live + Connect**, others **coming soon**, safety posture, how-it-works, application-details panel.
- **Salary benchmark engine** server-side (`POST /api/scanner/salary`, honest AI estimate) — Scan UI wiring pending.
- Component work follows the owner's 5 visual rules (states, alignment, overflow, SVG icons, responsive).

## Remaining

- **Phase 8** — more boards: ATS (Greenhouse/Lever — reliable, testable anywhere), then Bayt/Naukrigulf/GulfTalent via headed browser; per-board verification gating. (Bayt/Naukrigulf scrapers were removed from the active build — Cloudflare-blocked; see plan below.)
- **Phase 11 — Assisted Auto-Apply**: **v1 (Indeed) + Email-Apply shipped** (above). Remaining: verify on a real Indeed login/application (user's machine); then more boards (Bayt/Naukrigulf via same config pattern), **LinkedIn connect**, and the **LinkedIn-post discovery** for Email-Apply (assistive, needs LinkedIn connect). Optional SMTP one-click send (currently mailto/Gmail draft, no creds).
- **Phase 9** — LinkedIn import shipped (above); remaining: **Phase 9b** polished Chrome extension (wraps the same `/api/profile/linkedin/import` endpoint) + assisted batch apply.
- **Phase 10** — one-click Windows installer + auto-install Ollama.
- **Phase 18** — mock interview.
- Smaller items: wire the **salary benchmark** estimate into the Scan copilot UI; **multi-board chips** (needs Phase 8 boards); rebuild Scan "paste a job **link**" (paste a URL → fetch + score) to match the design.

**Lint:** clean — `eslint` passes (charts `useCountUp` split to its own file; the few intentional `set-state-in-effect` sites carry scoped justifications).

## Key docs
- Product/design spec: `docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md`
- Assisted-apply spec: `docs/superpowers/specs/2026-06-21-phase-11-assisted-auto-apply-design.md`
- LinkedIn profile sync spec: `docs/superpowers/specs/2026-06-24-linkedin-profile-sync-design.md`
- Scanner rework plan: `docs/superpowers/plans/2026-06-23-NEXT-naukrigulf-bayt-scanner-rework.md`
- Approved visual design: claude.ai/design project `be1ada00-42de-4811-9c55-6ad7bc8dece6` (`Jobs4UAE Autopilot.dc.html`).
