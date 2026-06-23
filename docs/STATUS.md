# Jobs4UAE Autopilot — build status

_Last updated: 2026-06-23_

A free, **local-first** job-search copilot for the GCC (UAE, Saudi, Qatar, Kuwait, Bahrain, Oman).
Runs entirely on the user's PC — Node/Express server (port 5123) + Vite/React app. **No cloud deploy**
(privacy by design: CV, answers and API keys never leave the machine). Not on Vercel.

## Done & on `main`

**Core pipeline**
- Setup wizard + AI engine (Gemini / OpenRouter / Local Ollama) with **OpenRouter free-model auto-fallback** (auto-discovers & rotates working free models; self-heals when a `:free` model is retired).
- My Profile — CV import (AI) → editable profile, now incl. **Projects / Certifications / Languages / Awards** + a **Profile copilot** rail (strength gauge + suggestions). LinkedIn sync = placeholder (Phase 9).
- Evaluate — honest A–F fit score with dimensions, matched/missing skills.
- Documents — tabbed **Tailored CV / Cover letter**, rendered preview (marked + DOMPurify) ↔ edit, **fit-after-tailoring gauge**, "still worth adding" skills + free-learn links, PDF download, regenerate.
- PDF export — UAE-style resume/cover (Playwright render).
- Tracker — saved → applied → interview → offer → rejected.

**Find & apply**
- **Scan** — Indeed board (real, live-verified; headed browser + embedded-JSON parse). Rebuilt as the design's 2-column **fit-&-tailor workspace**: ranked job list + sticky Copilot panel (fit dial, dimension-by-dimension, worth-strengthening, "Tailor my CV for this job").
- Auto-apply — placeholder (Phase 11).

**Design system & shell (Lumzi)**
- Tokens (cobalt primary, iris AI accents, hairline-first, IBM Plex), light + dark.
- Sidebar + topbar (per-route title, theme toggle), **AI Copilot panel (⌘J)** + **⌘K command palette** ("Ask the UAE job market").
- **Home dashboard** — animated pipeline donut, fit gauge, fit-trend sparkline, briefing, skill-gap insights, recent-activity timeline (all real data).
- **Settings page** — change AI engine/model/key in-app, application-details memory, privacy, GitHub feedback links.
- Bespoke, zero-dependency, token-themed SVG **chart primitives** (RadialGauge / Donut / Sparkline) + eased count-ups.

**Quality:** 167 tests passing (server + web utils); web builds clean.

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
- **Phase 11 — Assisted Auto-Apply backend** (page UI done): the live flow behind the Auto-apply page — persistent per-board browser session (connect/login), open job → **autofill** fields + CV PDF + cover letter + known answers → user clicks Submit; accumulating Q&A memory; optional email-apply. Needs the user's machine to test real board logins.
- **Phase 9** — LinkedIn assisted + real profile sync + batch apply.
- **Phase 10** — one-click Windows installer + auto-install Ollama.
- **Phase 18** — mock interview.
- Smaller items: wire the **salary benchmark** estimate into the Scan copilot UI; **multi-board chips** (needs Phase 8 boards).
- **Lint debt (pre-existing):** 4 advisory eslint errors (`react-refresh/only-export-components` in charts; `react-hooks/set-state-in-effect` for fetch-on-mount / modal-reset / count-up). Build + tests are green; clean these up via a charts file-split + scoped justifications.

## Key docs
- Product/design spec: `docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md`
- Assisted-apply spec: `docs/superpowers/specs/2026-06-21-phase-11-assisted-auto-apply-design.md`
- Scanner rework plan: `docs/superpowers/plans/2026-06-23-NEXT-naukrigulf-bayt-scanner-rework.md`
- Approved visual design: claude.ai/design project `be1ada00-42de-4811-9c55-6ad7bc8dece6` (`Jobs4UAE Autopilot.dc.html`).
