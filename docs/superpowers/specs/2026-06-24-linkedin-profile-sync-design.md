# LinkedIn Profile Sync — design

_2026-06-24 · Phase 9 (partial). Approved on Telegram ("Go", option A)._

## Goal

Let a user pull their **own** LinkedIn profile into **My Profile** with one click, the way
Rezi / Teal do — and **merge** it into the existing profile (fill gaps, add new roles/skills),
not blindly overwrite. Must stay **local-first**: the data is read in the user's own browser and
sent only to their local server (`localhost:5123`). Nothing touches a cloud.

## Why a bookmarklet, not a scraper

Public LinkedIn profiles are auth-walled and bot-blocked, so server-side fetch-by-URL fails (and is
SSRF-risky). The tools that work (Rezi, Teal, the open-source `joshuatz/linkedin-to-jsonresume`)
run **inside the user's logged-in LinkedIn tab** and call LinkedIn's own internal **Voyager API**
(`/voyager/api/...`) — the same backend the site uses. With the user's session cookie + CSRF token
it returns the complete profile as structured JSON (positions, educations, skills, certifications,
languages, volunteer, contact, headline, summary).

A **bookmarklet** is the lowest-friction way to ship that: one button dragged to the bookmarks bar,
no install, no Web Store, full fidelity. The backend it talks to (import + merge) is identical to
what a future Chrome extension would use, so a polished extension (Phase 9b) can wrap the same
endpoint later with zero rework.

**Honest caveat:** Voyager is unofficial and a ToS gray area. Mitigation: it's the user pulling
*their own* profile, occasionally, on demand; no automation/loops; data stays on their machine.

## Architecture

```
LinkedIn profile tab (logged in)
  └─ bookmarklet → loads loader.js from localhost
       └─ reads csrf cookie, GET /voyager/api/.../profileView  (user's session)
       └─ POST localhost:5123/api/profile/linkedin/import  { raw Voyager JSON }
            (fallback: download linkedin-profile.json → user uploads it)
                 │
   server  ──────┘
     map.js    linkedinToProfile(raw)  → our profile schema        (pure, unit-tested)
     merge.js  mergeProfile(existing, incoming) → { merged, changes } (pure, unit-tested)
     route     returns { merged, changes }  — does NOT save
                 │
   web  ─────────┘
     My Profile → "Import from LinkedIn" modal:
       drag-the-bookmarklet + instructions + file/paste fallback
       review screen: "N new experiences, M new skills, filled K fields" → Save / Cancel
```

## Components & contracts

### 1. `server/profile/linkedin/map.js` — `linkedinToProfile(raw)`
Pure function. Converts a LinkedIn payload → our `EMPTY_PROFILE` shape (`server/profile/schema.js`).
Tolerant of two input shapes, auto-detected:
- **Voyager `profileView`**: `positions.elements[]` → experience, `educations.elements[]` → education,
  `skills.elements[]` → skills, `certifications.elements[]` → certifications,
  `languages.elements[]` → languages, `volunteerExperiences` → (mapped into experience or awards),
  top-card `profile` → fullName/headline/summary/location. Dates from `{year,month}` → `"YYYY-MM"`.
- **JSON Resume** (`basics`, `work`, `education`, `skills`…): mapped field-by-field. Lets users who
  already have a JSON Resume file import it too.
Never invents data; missing fields → empty string/array. No network, no AI.

### 2. `server/profile/linkedin/merge.js` — `mergeProfile(existing, incoming)`
Pure function → `{ merged, changes }`. The real value over CV import.
- **Scalars** (fullName, email, phone, location, headline, summary): fill only if the existing value
  is blank; never silently overwrite a non-empty field. (`changes.filled` lists what got filled.)
- **Arrays** unioned by a normalized key, incoming items appended only if new:
  - experience → `company|title|startDate` (lowercased, trimmed)
  - education → `institution|degree|field`
  - certifications → `name|issuer`
  - languages → `name`; awards → `title|issuer`; projects → `name`
  - skills → deduped lowercased strings; links → deduped
- `changes` = `{ filled: string[], added: { experience: n, skills: n, … }, addedItems: {...} }`
  for the review UI. Merge does **not** persist; the route returns the candidate.

### 3. Route `POST /api/profile/linkedin/import` (in `profile.routes.js`)
Accepts **either** a JSON body (from the bookmarklet) **or** a multipart file upload (manual
fallback) containing the raw LinkedIn/JSON-Resume JSON. Pipeline:
`parse → linkedinToProfile → load current profile → mergeProfile → res.json({ merged, changes })`.
Validates input is recognizable LinkedIn/JSON-Resume JSON → 422 with a friendly message otherwise.
Does **not** save (UI saves via the existing `POST /api/profile` after review).

**CORS:** this route + the bookmarklet asset must allow `Origin: https://www.linkedin.com`
(echo it back) and answer the `OPTIONS` preflight. Scoped to these routes only — the rest of the
API stays same-origin. `http://localhost` is a browser-trusted secure context, so an HTTPS LinkedIn
page may POST to it.

### 4. Bookmarklet + loader (served by Express)
- `GET /linkedin/bookmarklet.js` — the **loader**: reads the `JSESSIONID` cookie as the
  `csrf-token` header, parses the public id from the URL, `GET`s the Voyager `profileView`,
  then `POST`s the raw JSON to `/api/profile/linkedin/import`. On success shows a small toast
  ("Imported — open Jobs4UAE to review"); on any failure (CORS, server down) it falls back to
  downloading `linkedin-profile.json`. Served as a static asset from `server/public/linkedin/`.
- The draggable bookmarklet itself is a tiny `javascript:` stub that injects the loader `<script>`,
  keeping it short and letting us update the loader without re-dragging.

### 5. Web UI — My Profile "Import from LinkedIn"
- Button opens a modal: (a) drag-this-button-to-your-bookmarks-bar target + 3-step instructions,
  (b) "already have a file? upload / paste JSON" fallback that hits the same endpoint.
- After import, a **review** panel: change summary ("3 new roles, 12 new skills, filled headline +
  location") and the merged profile preview → **Save** (existing `POST /api/profile`) or **Cancel**.
- `web/src/api.ts`: `importLinkedin(payload|file)`. Follows the existing 6px/hairline design system
  and the owner's 5 visual rules.

## Build order (each phase tested before the next)

1. **Server core** — `map.js` + `merge.js` + route, with unit tests (Voyager fixture, JSON-Resume
   fixture, merge cases: empty profile / partial overlap / all-duplicates, route happy + 422 + CORS
   preflight). _Fully verifiable here._
2. **Bookmarklet + loader** — served asset + draggable stub. (Loader's live Voyager call is only
   truly verifiable on the user's machine with their LinkedIn session — like Phase 11.)
3. **Web UI** — modal + review + Save wiring, design-system compliant.
4. **Docs** — update `docs/STATUS.md`; note Phase 9b = Chrome-extension wrapper of the same endpoint.

## Testing & verification
- Phases 1 & 3 are unit/integration-testable here (fixtures + existing vitest setup).
- Phase 2's live extraction needs the user's logged-in LinkedIn — ship it, then verify together on
  their machine (documented as a manual check, same posture as assisted-apply Phase 11).

## Out of scope (now)
- Full Chrome extension (Phase 9b) — same backend, later.
- Continuous/scheduled auto-sync — explicitly avoided (ToS + privacy). User-initiated only.
- LinkedIn batch-apply / live profile push.

## Non-goals / risks
- Voyager schema can change → `map.js` is tolerant and fixture-tested so breakage is a localized,
  testable fix.
- Never overwrite user-edited fields silently → merge fills blanks + appends, surfaces everything in
  the review screen before any save.
