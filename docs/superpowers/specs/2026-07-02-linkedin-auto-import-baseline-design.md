# LinkedIn Auto-Import + Auto-Baseline — design

_2026-07-02 · "Clone Huntr" — paste your LinkedIn, get a built profile + baseline with ~zero effort. Approved on Telegram ("Go ahead and implement")._

## Goal

Reproduce the Huntr experience the owner saw: **give your LinkedIn, the app imports your whole profile and builds a baseline (profile + base CV) on its own.** Must stay **free at any scale** (this is a free community tool) — so no paid scraping/enrichment API.

## What we learned (why this design)

Empirically tested during brainstorming:

- **Huntr's "paste URL → auto-import"** is a server call to a paid third-party LinkedIn-data API. Ruled out — costs per lookup + those providers get sued off the map (Proxycurl died in 6 months).
- **Free at any scale ⇒ the work must happen on the user's side** (their browser/session/residential IP), because the LinkedIn access + compute is theirs, not ours.
- **Server-side public fetch of a profile URL** (Googlebot UA) returns a `schema.org` **JSON-LD** block with `name`, `jobTitle`, `description` (headline), `address` (location), `worksFor` (current employers + start dates), `alumniOf` (education + years), photo. **Verified working from a residential IP.** But: **only the basics** (no skills, no full role history/bullets, no long About), and **almost certainly IP-blocked from Vercel's datacenter IPs** (the plain-UA fetch already hit the auth wall).
- **The complete profile** (skills, all roles, About) with **no manual screenshots** requires the **rendered, logged-in page** — reachable only by code running in the user's browser context. Our **local companion** (the local server already bundles Playwright for Scan/Auto-apply, runs on the user's residential IP) is exactly that context.
- **Vision extraction** (screenshot/image → structured profile via a multimodal LLM) is free on the engines we already support (Gemini Flash / OpenRouter free tier) and is **unblockable** — LinkedIn can't IP-block or CSP-block a screenshot.

## Approach

Layer the free techniques so each user gets the best available with the least effort, and reuse the existing `server/profile/linkedin/` pipeline (`linkedinToProfile` → `mergeProfile` → review → save) end to end.

```
Input (any of):
  (a) paste LinkedIn URL      → JSON-LD fetch  → jsonLdToProfile()      [basics; companion/residential IP]
  (b) upload screenshot/image → vision extract → visionToProfile()      [full; works on cloud]
  (c) companion auto-capture  → Playwright fullPage screenshot → (b)    [full; zero manual effort]
        ↓ (all normalize to our profile schema)
  mergeProfile(existing, incoming)  → { merged, changes }   (existing, reused)
        ↓
  buildBaseline(merged, engine)  → AI summary + categorized skills + base CV   (new, opt-in-but-default)
        ↓
  review screen → Save (existing POST /api/profile) + base CV saved to Documents
```

**Degradation is explicit and honest:** on the cloud site paste-URL will likely fail (Vercel IP) — the UI detects that and points the user to (b)/(c). On the companion, (a) fires instantly for prefill and (c) fills the rest.

## Components & contracts

### 1. `server/profile/linkedin/jsonld.js` — `jsonLdToProfile(node)` (pure, new)
schema.org `Person` node → our profile schema (via `normalizeProfile`). Maps `name`, `jobTitle[]` (joined → headline), `description` (summary), `address.addressLocality` (location), `worksFor[]` (→ experience: company + `member.startDate`), `alumniOf[]` (→ education: name + years), `sameAs`/`url` (→ links). Never invents; missing → empty. Add `extractJsonLd(html)` helper (pull + parse the `<script type="application/ld+json">` Person node). Unit-tested with the captured Gates fixture.

### 2. `server/profile/linkedin/fetchPublic.js` — `fetchLinkedinJsonLd(url)` (new)
Validates the URL is a `linkedin.com/in/...` profile. Fetches with a crawler UA, runs `extractJsonLd`. Returns `{ profile, partial: true }` or a typed error (`blocked` when auth-walled, `not_found`, `bad_url`). **Only mounted on the local/full app, not the cloud serverless app** (Vercel IP is blocked; keeps SSRF surface off the multi-tenant function). ToS note in header comment (own profile, user-initiated, crawler-visible SEO data).

### 3. `server/profile/vision.js` — `extractProfileFromImages(images, engine)` (new)
Sends 1+ profile screenshots to a **vision-capable** engine with an **anti-fabrication** prompt (transcribe only what's visible; never invent) → our profile schema. Requires extending the AI engine abstraction with an optional `visionComplete({ images, prompt })`; engines without vision throw a friendly "this engine can't read images — pick Gemini/OpenRouter" error. Multi-image inputs are merged (later images append/extend). Deterministic parse + `normalizeProfile`; unit-tested with a mocked engine.

### 4. `server/profile/baseline.js` — `buildBaseline(profile, engine)` (new)
After merge, auto-produce the "baseline": (a) AI-written professional **summary** if blank (anti-fabrication, from real roles only), (b) **skill categorization** (group flat skills), (c) a **base CV** document via the existing documents engine. Returns `{ profile, baselineDocId }`. Each step is best-effort + skippable (no engine / offline → skip, don't fail the import).

### 5. Routes (in `profile.routes.js`)
- `POST /api/profile/linkedin/url` `{ url }` → `fetchLinkedinJsonLd` → `mergeProfile` → `{ merged, changes, partial:true }`. **Local/full app only.**
- `POST /api/profile/linkedin/vision` (multipart, 1+ images) → `extractProfileFromImages` → `mergeProfile` → `{ merged, changes }`. **Cloud-safe.**
- `POST /api/profile/baseline` `{ profile }` → `buildBaseline` → `{ profile, baselineDocId }`.
- Companion auto-capture (Playwright full-page screenshot of the logged-in profile → feeds the vision route) lands in the local app's scan/companion area, reusing the existing Playwright setup. **Verified only on the user's machine** (same posture as Scan/Assisted-Apply).

### 6. Web UI — "Import from LinkedIn" (rework the existing modal)
One entry, three tabs by capability: **Paste URL** (with a "works best from the desktop companion" hint + graceful cloud fallback), **Upload screenshot(s)/PDF**, and **Auto-import** (companion only: one button → capture → done). All routes end at the existing **review screen** (change summary) → Save. A post-save "Building your baseline…" step calls `/api/profile/baseline`. Follows the 6px/hairline design system + the owner's 5 visual rules. Retire the dead Voyager bookmarklet + paste-URL-to-cloud path.

## Build order (each phase tested before the next)

1. **JSON-LD core** — `jsonld.js` (`jsonLdToProfile` + `extractJsonLd`) + `fetchPublic.js`, unit tests (Gates fixture, blocked/bad-url cases). Fully verifiable here.
2. **URL route** — `POST /linkedin/url` wired through merge, integration test. Local-only mount.
3. **Vision extraction** — engine `visionComplete` + `vision.js` + `/linkedin/vision` route, tests with a mocked vision engine. Cloud-safe. (Live accuracy verified together on a real profile screenshot.)
4. **Auto-baseline** — `baseline.js` + `/baseline` route + tests (mocked engine; skip-on-no-engine).
5. **Companion auto-capture** — Playwright full-page screenshot → vision route (local app). Verified on the owner's machine.
6. **Web UI** — reworked modal + review + baseline step, design-system compliant. Update `docs/STATUS.md`; remove the stale bookmarklet.

## Reuse (do not rebuild)
`mergeProfile` (fills blanks + appends by key, change summary, never overwrites), `normalizeProfile`/schema, the review UI, the documents engine (base CV), the AI engine abstraction, multer upload plumbing.

## Risks & mitigations
- **ToS / Googlebot-UA fetch** — user-initiated, own profile, occasional, crawler-visible data; local-only; no automation loops. Documented in-file.
- **Vercel IP block on URL fetch** — expected; URL route is companion-only, UI degrades to upload. (Verify once with a throwaway cloud probe in phase 2.)
- **Vision accuracy / hallucination** — strict anti-fabrication prompt + the mandatory review screen before any save; multi-image support for completeness.
- **Vision cost** — free-tier multimodal models (Gemini Flash / OpenRouter); large images downscaled before send.
- **Multi-tenant safety** — all stores already per-`userId`; drop the old global `setPending`/`takePending` hand-off (single-tenant) — the new routes return the candidate directly.

## Out of scope (now)
- Polished Chrome extension (a later wrapper of the vision/URL endpoints).
- Scheduled/continuous LinkedIn re-sync (ToS + privacy) — user-initiated only.
- DOCX export of the base CV (PDF/existing formats already shipped).
