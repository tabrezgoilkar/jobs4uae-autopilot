# ▶ START HERE NEXT SESSION — Scanner rework (Naukrigulf + Bayt that actually work)

> **Tomorrow's immediate step.** This is a **verification-first** plan: the dev sandbox CANNOT reach Naukrigulf/Bayt (Cloudflare returns HTTP 000 to non-browser traffic — verified 2026-06-22). The technique only works from the **user's real browser + home IP**, so step 1 is a debug capture the **user runs locally**, then we code the mapper from the real data.

## Where we are (context for whoever picks this up)
- App is at **Phase 13 done** (Lumzi design system + sidebar shell, merged to `main`). Roadmap design track = Phases 13–18 (14 re-skin pages, 15 Home dashboard, 16 AI Copilot + command palette, 17 scan extras salary/WhatsApp, 18 mock interview) — see `docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md` §9b.
- **Phase 7 scanners (Bayt/Naukrigulf) DO NOT work live** — they used headless fetch + cheerio; Cloudflare blocks that. Boards are `experimental`.
- **Decided approach** (spec §"Phase 8", committed): real **headed** Playwright Chromium on the user's machine/IP → navigate the **public** search page (no login → account-safe) → **intercept the site's own search XHR JSON** (`page.on('response')`) → map to listings. Apify scrapers pass Cloudflare with rotating residential proxies + anti-detect browsers (infrastructure we don't need; the user's real browser+IP is the equivalent).
- Account-safety: **scanning stays anonymous** (no login, no ban risk); auth is only for *applying* (user clicks Submit); **LinkedIn stays fully manual**.

## ⭐ STRONGLY CONSIDER FIRST — ATS-hosted boards (the reliable path; likely how career-ops gets 45–75+ working)
Before fighting Cloudflare on Naukrigulf/Bayt, add an **ATS board type**. Company career pages are hosted on Greenhouse/Lever/Ashby/Workday/SmartRecruiters, which expose **public JSON APIs with NO anti-bot, NO login**:
- Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/<company>/jobs?content=true`
- Lever: `GET https://api.lever.co/v0/postings/<company>?mode=json`
- Ashby: `POST https://api.ashbyhq.com/posting-api/job-board/<company>` (or the public posting API)
- These return clean JSON, work from ANY IP (the sandbox too — testable here!), and never break on selectors.
Build: an `ats` board type with a config of GCC employers (Careem, Talabat, Noon, etc.) + their ATS slug → reliable listings. This is the lowest-risk, highest-reliability source and a great FIRST scanner that actually works end-to-end. (career-ops's "portals" are exactly these company career pages — that's the "crack": pick scrape-friendly sources, not Cloudflare aggregators.)

## Goal
Make `POST /api/scanner/scan` return **real** listings — start with ATS-hosted company boards (reliable, testable anywhere), THEN the Naukrigulf/Bayt aggregators via real headed browser + XHR interception.

## Architecture / file changes
- `server/lib/browser.js` — add `captureXhr(url, { match, headless = false, timeout })`: launch Chromium (headed by default for live use; persistent context under `data/browser/scan/`), `page.on('response', …)` collect the first response whose URL matches `match`, `await page.goto(url, { waitUntil: 'domcontentloaded' })`, wait up to `timeout` for the match, return the parsed JSON (and the raw for debugging). Fallback: return rendered `page.content()` if no XHR matched.
- `server/scanner/boards/<board>.js` — each board gains:
  - `searchPageUrl({ keyword, country, city })` — the **public page a human opens** (NOT an API URL). Naukrigulf: `https://www.naukrigulf.com/<keyword-slug>-jobs-in-<country-slug>` (or with `?country=<numeric>` — confirm from debug). Bayt: `https://www.bayt.com/en/<country-slug>/jobs/<keyword-slug>-jobs/`.
  - `xhrMatch` — substring/regex identifying the data XHR (Naukrigulf: likely `/spapi/jobapi/search`; **confirm via debug step 1**).
  - `mapJson(json)` — map the captured JSON → `[{ title, company, location, url, source }]` (**write this from the real shape captured in step 1**).
- `server/scanner/engine.js` — `scan()` uses `captureXhr(board.searchPageUrl(...), { match: board.xhrMatch })` then `board.mapJson(...)`; graceful `{ listings: [], error }` on failure (already the pattern).
- **Board status registry** (the user's per-board gating): add `status: 'experimental' | 'verified' | 'production'` to each board; `GET /api/scanner/boards` returns status; the engine/route can filter to verified+production for end users; the Scan UI badges `experimental` boards. Promote a board to `verified` only after the live capture works.

## TASK 0 (do FIRST, user runs locally) — discover the real endpoint + JSON shape
Create `scripts/scan-debug.mjs` (a standalone Node script, NOT wired into the app):
- Usage: `node scripts/scan-debug.mjs naukrigulf accountant uae`
- Launches **headed** Chromium (`chromium.launch({ headless: false })`), opens the board's public search URL, logs EVERY response URL + content-type to the console, and dumps the body of any response whose URL contains `search`/`jobapi`/`api` to `./scan-debug-<board>.json`.
- The user (real IP) runs it, clears any Cloudflare "verify human" prompt in the visible window, and pastes back: (a) the list of XHR URLs, (b) the dumped JSON. → From that we set `xhrMatch` and write `mapJson` exactly.

## TASKS (after step 0 gives real data)
1. **Naukrigulf board** — set `searchPageUrl`, `xhrMatch`, `mapJson` from the captured shape; switch `engine.scan` to `captureXhr`. Keep `scanner-naukrigulf.test.js` unit tests but update the fixture to the **real** JSON shape; add a `mapJson(realFixture)` test. User verifies live (real Chromium opens, listings appear).
2. **Board status registry** — add status to boards, expose in `/api/scanner/boards`, filter + badge in `ScanPage`. Promote Naukrigulf → `verified` once live-confirmed.
3. **Bayt board** — repeat the debug-capture → map flow (Bayt may embed JSON-LD in the page instead of an XHR; `captureXhr`'s DOM fallback + a JSON-LD parse path covers that).
4. **UX note:** scanning now opens a **visible browser window** (headed). That's expected and aligns with the Connections/headed model; tell the user so it isn't surprising. Consider a "scanning…" state while the window works.

## Honest constraints to keep in the build
- Headed + human-paced + low-volume + on-demand only (no background polling).
- Anonymous (no login) for scanning. Per-board `experimental` until live-verified on the user's machine.
- Tests are fixture-based (structure), real verification is manual on the user's machine — same honesty as Phase 7.

## Testing
- Unit (vitest): `buildSearchUrl`/`searchPageUrl` shape; `mapJson(realFixture)` → expected listings; engine graceful-failure. Mock `captureXhr` in `api-scanner.test.js`.
- Live (user): run a real scan; confirm listings; promote to `verified`.

---
*Other ready-to-go threads (not tomorrow's first step): Phase 14 re-skin pages to Lumzi (design already approved — `Jobs4UAE Autopilot.dc.html` in the claude.ai/design project `be1ada00-42de-4811-9c55-6ad7bc8dece6`, read via DesignSync MCP); Phase 11 Assisted Auto-Apply spec is written (`2026-06-21-phase-11-assisted-auto-apply-design.md`).*
