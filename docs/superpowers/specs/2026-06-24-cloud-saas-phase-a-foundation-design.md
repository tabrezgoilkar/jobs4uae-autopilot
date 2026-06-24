# Cloud SaaS — Phase A (multi-tenant foundation) — design

_2026-06-24 · Approved direction on Telegram: option **B** (multi-user product), AI model **3** (hybrid)._

## Context & the big decision

Jobs4UAE Autopilot was built **local-first** (Express on :5123 + Vite/React, all data in
`data/*.json`, nothing leaves the machine). The owner now wants it online as a **multi-user
product** with login — **without losing any feature**, including Scan and Assisted Auto-Apply.

Hard architectural fact: **Scan and Assisted Auto-Apply drive a real, visible browser the user
logs into** — no serverless platform (Vercel or otherwise) can do that for the user. So the product
is necessarily **hybrid**:

- **Cloud (this spec, Phase A):** UI + auth + database + the AI/data features.
- **Desktop companion (Phase B, later):** a small local app that runs the browser features
  (Scan, Assisted Auto-Apply) on the user's PC, paired to their cloud account.
- **Phase C (later):** billing, polish.

This spec covers **Phase A only**.

## Phase A goal

A deployed, multi-tenant web app where users sign up, log in, and use the cloud-compatible
features with their own isolated data:
**Profile, Evaluate, Documents (incl. PDF export), Tracker, Dashboard, Settings, Salary,
Email-Apply (compose), LinkedIn import.**
Scan / Assisted Auto-Apply / Connections appear but are gated behind "Install the desktop
companion (coming in Phase B)".

## Stack (Vercel-native, least churn)

- **Frontend:** the existing Vite + React app, built static and served by Vercel.
- **Backend:** the existing Express routers, mounted in a **single serverless function**
  (`api/index.js` exporting the Express app) with a Vercel rewrite `/(api/.*)` → that function.
  Keeps all current route code; avoids a Next.js rewrite.
- **Auth:** **Clerk** (Vercel Marketplace native). React side: `<ClerkProvider>` + sign-in/up.
  API side: verify the Clerk session token per request → `req.userId`.
- **Database:** **Neon Postgres** (Vercel Marketplace). See storage adapter below.
- **PDFs:** generated on demand. On Vercel, Playwright's headless Chromium is swapped for
  `playwright-core` + `@sparticuz/chromium` inside the function (headless, short task — fine,
  unlike the *headed* apply browser). No Blob needed in Phase A (regenerate per request); Blob is a
  later optimisation.
- **AI (hybrid, model 3):** owner key in a server env var with a per-user free-tier limit; users
  may add their own key (BYOK) to bypass the limit.

## The central pattern: a storage adapter (keeps local dev working)

Every current store reads/writes a whole JSON collection from `data/<name>.json`. We introduce a
**KV-JSON adapter** so the same store code runs both locally (filesystem, single user) and in the
cloud (Postgres, per-user) with **no route changes**:

```
kv.getJson(userId, key)         -> object | null
kv.setJson(userId, key, value)  -> value
```
- `key` ∈ { profile, application-details, documents, tracker, evaluations, settings }.
- **Filesystem impl** (local dev / no DATABASE_URL): `data/<userId>/<key>.json`
  (userId = "local" when auth is bypassed) — preserves today's behaviour.
- **Postgres impl** (DATABASE_URL set): one table
  `app_state(user_id text, key text, data jsonb, updated_at timestamptz, primary key(user_id,key))`.
  Whole-collection get/set mirrors the file semantics; per-item ops (getDocument by id, etc.) load
  the collection and filter in code — fine at single-user-per-tenant scale. (Normalising into real
  tables is a documented later step; jsonb-per-collection is the least-churn migration.)

Each store (`profile/store.js`, `apply/answers/store.js`, `documents/store.js`, tracker, evaluate,
config→settings) is refactored from "read file" → "`kv.getJson(userId, key)`", taking `userId` as
the first arg. Routes pass `req.userId`.

## Auth

- **Frontend:** wrap the app in `<ClerkProvider>`; add `/sign-in` and `/sign-up`; gate the app
  shell behind `<SignedIn>` (redirect to sign-in otherwise). Clerk's session token is attached to
  API calls (fetch wrapper adds `Authorization: Bearer <token>`).
- **Backend middleware** (`server/auth/clerk.js`): verifies the Clerk token → sets `req.userId`.
  **Dev bypass:** if `CLERK_SECRET_KEY` is unset (local dev), `req.userId = 'local'` so the owner's
  current workflow keeps working with no Clerk account. All store calls use `req.userId`.

## Hybrid AI (model 3)

- **Owner key** in `OWNER_AI_KEY` (+ engine/model env). **Free tier:** a per-user daily call cap
  (`FREE_TIER_DAILY` env, default **25**/day), tracked in `app_state` under key `usage`
  (`{ "YYYY-MM-DD": count }`). Under the cap, calls use the owner key and increment usage. Over it →
  `402` with a friendly "add your own key or try tomorrow" message.
- **BYOK:** a user-saved key (Settings) **encrypted at rest** (AES-256-GCM with `APP_SECRET` env)
  in their `settings`. If present, it's used and **bypasses** the free-tier counter.
- **Engine selection wrapper** (`server/ai/forUser.js`): given `userId`, returns an engine bound to
  the right key (user BYOK → owner-key-with-limit → error), decrypting BYOK and enforcing/incrementing
  usage. The existing engine adapters (gemini/openrouter/ollama) are unchanged underneath.

## What's gated to Phase B (the desktop companion)

Scan, Assisted Auto-Apply, and Connections need a headed local browser, so in the cloud they render
an **"Install the desktop companion"** state (no fake functionality). The companion (Phase B) will
pair to the cloud account and expose the existing `apply/browser.js` + `scanner` code locally; the
cloud UI will talk to it. Out of scope here.

## Build slices (each specced behaviour, TDD, shippable)

- **A1 — Storage adapter + store refactor.** `kv` interface, filesystem + Postgres impls; refactor
  every store to `(userId, …)` via `kv`. Tests: both impls round-trip; per-item ops still work;
  `local` userId preserved. _(No deploy yet; local still runs.)_
- **A2 — Auth.** Clerk verify middleware + dev bypass; thread `req.userId` through all routes;
  per-user data isolation. Tests: two users can't see each other's data; dev bypass → `local`.
- **A3 — Hybrid AI.** `forUser` engine selector + AES-GCM BYOK encryption + free-tier usage
  counter + `402` over limit. Tests (mocked engine): BYOK bypasses limit; owner key increments;
  over-limit blocks; encryption round-trips.
- **A4 — Vercel packaging.** `api/index.js` (Express as one function) + `vercel.json` rewrites +
  static build; serverless Chromium for PDF; env wiring (Clerk, Neon, OWNER_AI_KEY, APP_SECRET).
  Provision Neon + Clerk via the Vercel Marketplace. Verify a preview deploy.
- **A5 — Clerk frontend + gating.** `<ClerkProvider>`, sign-in/up, protected shell, token in the
  fetch wrapper; gate Scan/Apply/Connections behind the "desktop companion (Phase B)" state.

## Testing & verification

- A1–A3 are unit/route-testable in the existing vitest setup (Postgres impl tested against a
  throwaway schema or a mocked pg client; encryption + usage are pure logic).
- A4/A5 are verified on a **Vercel preview deployment** (auth flow, a real signed-in API round-trip,
  a PDF render in the function). Deploy/login verification is inherently manual.

## Risks & mitigations

- **Serverless cold starts / monolithic Express function** — acceptable at this scale; revisit
  per-route functions or Next.js only if needed.
- **Privacy reversal** — data now lives server-side; mitigations: per-user isolation, AES-GCM for
  secrets, HTTPS-only, and a clear privacy note. (The local-first build remains available.)
- **PDF in serverless** — `@sparticuz/chromium` has size/time limits; if it's flaky, fall back to a
  hosted render or move PDF to the companion.
- **Scope** — Phase A is large; the 5 slices keep it incremental and each independently shippable.

## Out of scope (Phase A)

Desktop companion (Scan/Apply/Connections online) — Phase B. Billing/plans — Phase C. Team/org
accounts, admin dashboards, email notifications — later.
