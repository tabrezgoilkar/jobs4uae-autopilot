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

**Quality:** 141 server tests passing; web builds clean.

## Remaining

- **Phase 8** — more boards: ATS (Greenhouse/Lever — reliable, testable anywhere), then Bayt/Naukrigulf/GulfTalent via headed browser; per-board verification gating. (Bayt/Naukrigulf scrapers were removed from the active build — Cloudflare-blocked; see plan below.)
- **Phase 11** — Assisted Auto-Apply (spec written): connect a board once → autofill → **user clicks Submit**; optional email-apply for hidden jobs.
- **Phase 9** — LinkedIn assisted + real profile sync + batch apply.
- **Phase 10** — one-click Windows installer + auto-install Ollama.
- **Phase 18** — mock interview.
- Smaller design-parity items: Documents "what changed" diff (needs a stored pre-tailor baseline), Scan salary benchmark + multi-board chips (need Phase 8 data), Tracker visual polish.

## Key docs
- Product/design spec: `docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md`
- Assisted-apply spec: `docs/superpowers/specs/2026-06-21-phase-11-assisted-auto-apply-design.md`
- Scanner rework plan: `docs/superpowers/plans/2026-06-23-NEXT-naukrigulf-bayt-scanner-rework.md`
- Approved visual design: claude.ai/design project `be1ada00-42de-4811-9c55-6ad7bc8dece6` (`Jobs4UAE Autopilot.dc.html`).
