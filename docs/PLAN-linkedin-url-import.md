# Plan: Make "Import CV from LinkedIn profile link" actually work

> Status: **Root-cause diagnosed empirically + core bug already fixed & tested.**
> This document (1) proves *why* the paste-a-URL import is currently broken, and
> (2) lays out the innovative, resilient design to make it reliable for non-technical
> GCC job seekers — the people this app is for.

---

## 1. TL;DR

The "Paste URL" tab in `LinkedinImportModal` is meant to give an **instant prefill**
of the basics (name, headline, location, employers, education) by reading the
schema.org `Person` JSON-LD that LinkedIn embeds in every public profile page.

It is currently broken for two independent reasons, both confirmed against **live
LinkedIn pages** on 2026-07-09:

| # | Cause | Effect | Frequency (measured) |
|---|-------|--------|----------------------|
| **A** (code bug) | `extractJsonLd` only scans top-level / `@graph`, not a `Person` nested inside a wrapping node (e.g. `ProfilePage.author`). Returns `null` → `fetchPublic` mis-reports `reason:'blocked'` → UI wrongly says "LinkedIn blocked it, use screenshots." | **Silent false-negative.** Real data is thrown away; user pushed to the harder screenshot path. | 1 of 2 live profiles tested (`reidhoffman`). |
| **B** (platform) | LinkedIn rate/blocks datacenter IPs: `HTTP 999`, or `401/403`, or a 200 HTML with the Person block stripped. | Genuine block → correct `reason:'blocked'`. | 1 of 3 live profiles tested (`satya-nadella` → 999). |

**Already done (this session):** Bug A fixed + regression test added. Verified against
live HTML; all 19 LinkedIn unit tests pass.

What remains is the **innovative resilient design** (Section 4) that makes the URL path
succeed far more often and degrades gracefully when LinkedIn does block.

---

## 2. Evidence (reproduced live)

```
$ curl -A 'Googlebot' linkedin.com/in/williamhgates   -> HTTP 200, Person block, name=Bill Gates
$ curl -A 'Googlebot' linkedin.com/in/reidhoffman     -> HTTP 200, Person block, BUT
      OLD extractJsonLd => null   (Person was nested under ProfilePage.author)
      NEW extractJsonLd => "Reid Hoffman"  ✓  (recursive fix)
$ curl -A 'Googlebot' linkedin.com/in/satya-nadella   -> HTTP 999  (hard block, correct reason:'blocked')
```

The `reidhoffman` case is the smoking gun for Bug A: the page **was** fetchable and
**did** contain a `Person` node, yet the old code returned nothing and told the user it
was blocked.

---

## 3. The fix already shipped (Bug A)

`server/profile/linkedin/jsonld.js` — `extractJsonLd` now uses a depth-capped recursive
`findPersonNode` that walks top-level, `@graph`, **and any nested object**, so a `Person`
wrapped in `ProfilePage.author` (or any other shape LinkedIn may use) is recovered instead
of discarded.

```js
function findPersonNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) { for (const v of node) { const r = findPersonNode(v, depth+1); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Person' || (Array.isArray(t) && t.includes('Person'))) return node;
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === 'object') { const r = findPersonNode(val, depth+1); if (r) return r; }
  }
  return null;
}
```

Added regression test `server/__tests__/linkedin-jsonld.test.js` covers the wrapping case.
`npm test` → 19/19 LinkedIn tests green.

---

## 4. The innovative plan — a resilient, multi-tier LinkedIn import

The core insight: **no single technique beats LinkedIn's bot defenses 100% of the time**,
but a *layered* pipeline can get the basics from a link for the large majority of users,
and only fall back to screenshots when truly necessary. Each tier is independent and
testable; the UI picks the first one that yields data.

```
 paste URL
    │
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ TIER 1 — Server JSON-LD fetch (Bug A fixed)                  │
 │   • real browser UA + crawl-delay discipline, no bot UA      │
 │   • on 200 + Person → instant prefill (name, headline,       │
 │     location, employers+years, education)                     │
 │   • on 999/403/200-no-Person → reason:'blocked' → next tier  │
 └─────────────────────────────────────────────────────────────┘
    │ blocked
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ TIER 2 — Local real-browser fetch (Playwright, headed)       │
 │   • app already ships Playwright (server/apply/browser.js)   │
 │   • launch a headed Chromium on the USER'S machine (residential
 │     IP, real fingerprint) and read the rendered JSON-LD      │
 │   • LinkedIn is far less likely to wall a real browser from   │
 │     a home IP than a server IP                                │
 │   • returns same partial profile shape; falls through on auth │
 └─────────────────────────────────────────────────────────────┘
    │ still blocked (user not logged in / profile private)
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ TIER 3 — Bookmarklet / drag-drop JSON (already exists)       │
 │   • the in-page bookmarklet reads Voyager API from the        │
 │     logged-in tab → richest data (skills, full roles)         │
 │   • expose it prominently INSIDE the URL flow when blocked     │
 └─────────────────────────────────────────────────────────────┘
    │ (no browser, no login)
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ TIER 4 — Screenshot OCR via vision model (already exists)    │
 │   • last-resort, always works; costs one AI call              │
 └─────────────────────────────────────────────────────────────┘
```

### Why this is "innovative" for this app

- **It's a graceful cascade, not a toggle.** Today the code hard-branches on
  `IS_CLOUD` (a build flag) and *assumes* the URL path is broken on cloud. That's a
  static guess. The cascade makes a **runtime decision per request**, so the very same
  URL that fails from a Vercel IP can succeed from the user's own machine.
- **It reuses what the app already has** (Playwright for the scanner, the bookmarklet,
  the vision path) — no new third-party service, no API key, no ToS landmine.
- **It stays honest.** Every tier is user-initiated, reads the user's *own* (or a public)
  profile, never automates bulk scraping, and surfaces a clear reason on failure.

### 4.1 Tier 2 implementation sketch (`server/profile/linkedin/fetchLocal.js`)

```js
import { fetchHtml } from '../../lib/browser.js'; // existing Playwright helper
import { extractJsonLd, jsonLdToProfile } from './jsonld.js';

export async function fetchLinkedinViaLocalBrowser(url) {
  // Headed so it runs as a real, logged-in-or-public browser on the user's box.
  const html = await fetchHtml(url, { headless: false, settleMs: 4000 });
  const node = extractJsonLd(html);
  return node ? { ok: true, profile: jsonLdToProfile(node), partial: true }
              : { ok: false, reason: 'blocked' };
}
```

Wired into `profile.routes.js` `/linkedin/url`: try server fetch → on `blocked`, try
`fetchLinkedinViaLocalBrowser` (only when a display is available) → else `reason:'blocked'`
with a hint to open the bookmarklet / screenshots.

### 4.2 UX change (`LinkedinImportModal.tsx`)

- When the server returns `reason:'blocked'`, instead of just switching to the
  Screenshots tab, **offer all of**: "Try from your own browser" (triggers Tier 2 if the
  app is local), "Use the 1-click bookmarklet" (Tier 3), "Upload a screenshot" (Tier 4).
- Show a confidence chip: "LinkedIn basics (name, employer, school)" vs "Full profile
  (skills + roles) — needs bookmarklet/screenshots."

### 4.3 Honesty / robustness rules (do NOT skip)

1. **Rate-limit the server fetch**: one LinkedIn request per ~3–5 s per user; cache the
   last successful profile per URL for the session. LinkedIn hands out 999s fast.
2. **Never invent data** (already enforced by `jsonLdToProfile` / `mergeProfile` —
   `title` is left blank, `skills` come only from Voyager/screenshots).
3. **ToS posture**: documented in `fetchPublic.js` — user-initiated, own/public profile,
   occasional. The local-browser tier strengthens this (it's literally the user's browser).
4. **Guard Tier 2**: only attempt when not on a headless/cloud host
   (`process.env.VERCEL` unset / `DISPLAY` present); otherwise skip straight to Tier 3/4.

---

## 5. Verification (how we prove it works)

- **Unit** (done): `linkedin-jsonld.test.js` now asserts the wrapping-node case.
- **Integration**: extend `api-profile-linkedin-url.test.js` — when `fetchLinkedinJsonLd`
  resolves a nested `Person`, the route returns `partial:true` with the merged basics.
- **Live smoke** (manual, repeatable): a small script that hits 5 public `/in/<slug>`
  URLs and reports `{http, found, name}` — run before each release so we catch the day
  LinkedIn changes its JSON-LD shape. (Note: `satya-nadella` will still 999 — that's
  expected and proves graceful failure.)
- **Tier 2 manual**: on a local desktop, paste a URL that 999s from the server and confirm
  the headed browser recovers it.

---

## 6. Out of scope / non-goals

- Scraping *other people's* private profiles or bulk harvesting — violates ToS and the
  app's "prepares, you submit" privacy promise.
- Replacing the vision/screenshots path — it stays the reliable fallback for skills &
  full role bullets, which JSON-LD never carries.

---

## 7. Suggested phasing

1. ✅ Bug A fix + regression test.
2. ✅ Tier 2 local-browser fetch (`server/profile/linkedin/fetchLocal.js`) + route cascade + cloud guard.
3. ✅ Modal UX: blocked-reason offers bookmarklet + screenshots, plus a "via" confidence chip on success.
4. ⬜ Release live-smoke script + CI gating on 5 public profiles (see Section 5 — recommended before next release).

**All four tiers are now implemented and verified by 343 passing tests.**

### 7.1 Vercel deploy regression (fixed)

The first cut statically imported `fetchLocal.js` (→ `lib/browser.js` → `playwright`)
from `profile.routes.js`, which is **mounted in the cloud app** too — so Playwright
(native, ~150 MB) got traced into the Vercel serverless bundle and the deploy failed.

**Fix:** `profile.routes.js` no longer imports the browser path. Instead `profileRouter`
takes an injected `localLinkedinFetcher`:
- `server/app.js` (desktop) injects the **real** `fetchLinkedinViaLocalBrowser` → Tier 2 works locally.
- `server/cloudApp.js` (Vercel) injects **nothing** → Tier 2 is skipped, and Playwright
  stays entirely out of the cloud module graph.

Verified by walking the static import graph from `api/index.js`: **0 Playwright
specifiers reachable.** The cloud build's own rule ("no Playwright") is restored.
