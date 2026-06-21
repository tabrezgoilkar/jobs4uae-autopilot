# Phase 11 — Assisted Auto-Apply — Design Spec

**Date:** 2026-06-21
**Status:** Draft — pending user review
**Project:** Jobs4UAE Autopilot

---

## 1. Summary

Assisted Auto-Apply lets a user apply to GCC jobs with most of the work done for them, while keeping a human at the final **Submit** button. The user **connects** their job-board accounts once (logging in themselves in a browser the app opens), and from then on the app can open a job, **autofill** the application form (contact details, resume PDF, cover letter, and screening-question answers), surface any **unknown** questions for the user to answer once, and let the user **review the real form and click Submit**.

The defining principle: **the app prepares and assists; the user submits. It never stores passwords, never defeats anti-bot/CAPTCHA, never clicks Submit unattended, and never fabricates factual answers.**

This is new scope: the forked `santifer/career-ops` is human-in-the-loop and does **not** auto-submit. Assisted Auto-Apply is the realistic, safe interpretation of this project's "Autopilot" name.

## 2. Goals

- A **Connections** tab where the user connects boards (Indeed first; then Bayt, Naukrigulf, LinkedIn) with one **Connect** click + manual login; sessions persist locally for reuse.
- An **apply flow**: open a job → autofill contact fields, attach the resume PDF, paste the cover letter, fill known screening answers → ask the user any unknown questions → user reviews the live form and submits.
- A reusable **Application Details** store of standard GCC answers (nationality, visa/iqama status, notice period, current & expected salary, willing-to-relocate, driving licence, languages, …) **plus an accumulating Q&A memory** that grows every time the user answers a new question — so it's asked only once (LinkedIn-Easy-Apply style).
- **Anti-fabrication guardrail:** factual answers are filled only from stored data or asked from the user; the AI may *draft* free-text answers from the real profile, clearly marked for review.
- **LinkedIn profile sync:** once LinkedIn is connected, optionally read the user's **own** LinkedIn profile and propose enrichments to their app Profile (headline, summary, experience, skills, education, certifications) for **review-and-merge** — capturing what people keep current on LinkedIn but stale in their CV.
- Local, free, private: sessions and answers stay on the user's PC.

## 3. Non-Goals (v1) — explicit safety boundaries

- **No unattended submission.** The app never clicks the employer's final Submit/Apply button. The human always does.
- **No credential storage.** The app stores only the logged-in browser **session** (cookies/local storage in a local profile dir), never usernames/passwords.
- **No CAPTCHA / anti-bot defeat.** If a board challenges, the user resolves it in the visible window.
- **No fabricated facts.** Salary, visa status, nationality, dates, etc. are never invented.
- No bulk/mass auto-applying across many jobs unattended (that would require all of the above). Batch *evaluation* remains Phase 9; batch *applying* is out of scope.
- Not all boards in v1 — **Indeed first**, then others via the same pattern.

## 4. Users & Key Flows

**Connect (one-time per board):**
1. User opens **Connections**, clicks **Connect** on Indeed.
2. The app opens a visible browser window at Indeed's login. The user logs in (and clears any OTP/CAPTCHA themselves).
3. User clicks **"I've logged in"** in the app. The app saves the session locally and marks Indeed **✅ Connected**.

**Apply (per job):**
1. User starts an application (v1: pastes a job URL; later: from a scanned/saved job). Optionally links a saved evaluation/documents for tailoring.
2. The app opens the job in the connected browser, runs the board's field-map + a generic heuristic filler: contact fields, **resume PDF** upload, **cover letter** paste, and any screening questions it already has answers for.
3. Unknown questions appear in the app's **review panel**. The user answers them once; answers are saved to Application Details memory and filled into the form.
4. The user **reviews the actual form** in the browser window and clicks **Submit** themselves.
5. (Optional, ties to Phase 6 tracker) the application is recorded as "applied".

## 5. Architecture

```
Connections tab ─┐                         ┌─ Playwright persistent browser (visible window)
Apply page ──────┼─ React UI (control) ───►│   per-board profile: data/browser/<board>/
                 │        │  HTTP /api      │   (cookies/session persist; NO passwords)
                 ▼        ▼                 └─ user logs in here / reviews form / clicks Submit
        ┌─────────────────────────────────────────────┐
        │ server/apply/                                │
        │  connections/manager.js  (connect/confirm/   │
        │                           status/disconnect) │
        │  browser.js              (launch persistent  │
        │                           context per board) │
        │  boards/indeed.js …      (loginUrl +         │
        │                           field-map config)  │
        │  autofill.js             (open job, fill     │
        │                           known, detect      │
        │                           unknown questions) │
        │  match.js (AI)           (question→answer    │
        │                           match; draft text; │
        │                           no fabrication)    │
        │  answers/store.js        (Application Details│
        │                           + accumulating Q&A)│
        └─────────────────────────────────────────────┘
```

### 5.1 Components (each independently testable)

- **Connections manager** — launches a board's login in a persistent browser context, lets the user confirm login, persists/clears the session, reports `connected` status (best-effort: confirmed by the user, optionally verified by probing a logged-in-only URL).
- **Browser controller** — wraps Playwright `launchPersistentContext` with a per-board user-data dir under `data/browser/<board>/`; always **headed** (visible) so the user can see/act; exposes the active page to the autofiller. Never calls `.click()` on a submit control.
- **Board configs** (`apply/boards/<board>.js`) — `{ id, name, loginUrl, loggedInProbe?, fieldMap, fileUploadSelector? }`. Config-driven so boards are added/fixed without touching the engine.
- **Autofiller** — given a job page + board config + Application Details: fills mapped/heuristic fields, uploads the resume PDF, pastes the cover letter, fills matched screening answers, and returns a list of **pending questions** it couldn't answer. Applies user-provided answers on a second pass. Never submits.
- **AI matcher** (`match.js`) — maps a detected form question/label to a stored answer (semantic match); drafts free-text answers from the real profile with the anti-fabrication rule. Uses the existing AI adapter.
- **Application Details store** (`answers/store.js`) — see §6.
- **LinkedIn profile sync** (`apply/linkedin/profile-sync.js`) — reads the user's own LinkedIn profile via the connected session and produces a profile diff for review-and-merge; reuses the AI adapter and the Phase 2 profile schema. See §6.5.

### 5.2 Data model (JSON files, consistent with Phases 1–4)

- `data/application-details.json`:
  ```json
  {
    "fields": {
      "nationality": "", "visaStatus": "", "noticePeriod": "",
      "currentSalary": "", "expectedSalary": "", "willingToRelocate": "",
      "drivingLicence": "", "languages": []
    },
    "memory": [
      { "id": "...", "questionLabel": "Expected salary (AED)", "normalizedKey": "expected salary",
        "answer": "18000", "source": "user", "updatedAt": "..." }
    ]
  }
  ```
- `data/browser/<board>/` — Playwright persistent profile (session only).
- `data/connections.json` — `{ "indeed": { "connected": true, "updatedAt": "..." }, ... }`.

## 6. Anti-Fabrication Answer Memory (the core principle)

When the autofiller meets a form question:
1. **Structured field match** — if it maps to a known `fields.*` value, fill it.
2. **Memory match (AI semantic)** — else, ask the matcher to find a stored `memory[]` answer whose `normalizedKey` matches the question. If found, fill it.
3. **Draftable free-text** — if the question is open-ended (e.g. "Why are you a good fit?"), the AI **drafts** an answer from the real profile + job, returned as an **editable draft** (clearly labelled), never as a silent fact.
4. **Unknown factual question** — otherwise it becomes a **pending question**: the user answers it in the review panel; the answer is appended to `memory[]` and reused next time.

Factual fields (salary, visa, nationality, dates) are **never** invented in steps 3–4 — they are filled from `fields`/`memory` or asked. This is the user's explicit "don't fake any data" requirement.

## 6.5 LinkedIn Profile Sync (profile enrichment)

People keep their LinkedIn profile current but rarely update their CV. Once the user **connects LinkedIn** (§4 Connect flow), the Connections card (and the Profile page) offer **"Sync from LinkedIn"**:

1. Using the connected LinkedIn session, the app opens the user's **own** profile page and reads the visible structured content (headline, about/summary, experience, education, skills, certifications, languages).
2. The AI normalizes it into the app's Profile shape (the Phase 2 schema) and produces a **diff** against the current saved profile: new items, changed items, and items only in the CV.
3. The user sees a **review-and-merge** screen — accept all, pick individual additions, or skip. Nothing is silently overwritten.
4. Accepted changes are merged into `data/profile.json`, immediately improving evaluations, tailored documents, and autofill.

**Constraints:** reads only the **user's own** profile (their data, their session); **review-and-merge** only (no silent overwrite, no fabrication — it captures real LinkedIn content); subject to LinkedIn anti-bot, so it's a one-shot read of one's own page, not a crawler. If reading fails, the app says so and the profile is unchanged.

## 7. Boards (Indeed first)

- **v1: Indeed** (`ae/sa/qa` regional) — `loginUrl` for Connect; field-map for the "Apply with Indeed" hosted form + a generic heuristic filler fallback.
- Later, same pattern: **Bayt**, **Naukrigulf**, **LinkedIn** (LinkedIn kept lightweight given anti-bot/ToS). Each is a config file; the engine is unchanged.

## 8. Routes

- `GET /api/connections` — list boards + connected status.
- `POST /api/connections/:board/connect` — open login window for the board.
- `POST /api/connections/:board/confirm` — user confirms login; persist session, mark connected.
- `POST /api/connections/:board/disconnect` — clear saved session.
- `POST /api/connections/linkedin/sync-profile` — read the user's own LinkedIn profile via the connected session and return `{ proposed, diff }` for review-and-merge (does not save until accepted).
- `POST /api/profile/merge` — apply the user-accepted subset of LinkedIn enrichments into `data/profile.json`.
- `GET/POST /api/application-details` — load/save the structured fields + memory.
- `POST /api/apply/start` — `{ board, jobUrl, evaluationId?, documentId? }` → open job, autofill, return `{ filledCount, pendingQuestions[] }`.
- `POST /api/apply/answer` — `{ answers: [{questionId, answer}] }` → fill them, persist new ones to memory, return remaining pending.
- (No "submit" route — the user submits in the window.)

## 9. Frontend

- **Connections page** (`/connections`) + nav — board cards with status, Connect/Reconnect/Disconnect. The LinkedIn card (when connected) also shows **"Sync from LinkedIn"**, opening the review-and-merge screen.
- **LinkedIn sync review-and-merge** — a side-by-side of proposed LinkedIn data vs current profile, with per-item accept/skip, then merge.
- **Apply page** (`/apply`) — choose a connected board, paste a job URL (or pick a saved evaluation/document), **Start** → shows filled summary + a **review panel** listing pending questions to answer (with AI drafts for free-text), then a clear instruction: *"Review the form in the browser window and click Submit."*
- **Application Details page** (or section) — edit the standard GCC fields + view/edit remembered answers.

## 10. Dependencies & Sequencing

- **Resume PDF attachment requires Phase 5 (PDF export).** Recommended order: **build Phase 5 first, then Phase 11 v1.** (Alternative: prototype the apply flow with cover-letter text only and add PDF attach once Phase 5 lands.)
- **Job-URL entry** is used in v1 so this does **not** block on scanning (Phases 7–9); scanning integration (apply straight from a scanned job) comes later.
- Optional tie-in to **Phase 6 tracker** to record "applied" status (additive; not required for v1).
- **LinkedIn connect + profile sync** come after the Indeed apply pattern is proven (LinkedIn is the most anti-bot/ToS-sensitive board); profile sync depends on LinkedIn being connected, so it ships with the LinkedIn connector, not in the Indeed-first slice.

## 11. Risks & Mitigations

- **Anti-bot (e.g. Cloudflare on Indeed):** assisted mode (real manual login + human submit) is far less bot-like; the visible window lets the user clear challenges; we never headless-bypass.
- **Selector drift:** boards change HTML — field-maps are config-driven, with a generic heuristic fallback and graceful "couldn't fill this field, please complete it" messaging.
- **ToS:** assisting a logged-in human who clicks Submit is materially different from unattended automation; we keep it assistive and never store credentials. LinkedIn kept deliberately light.
- **Wrong answers:** anti-fabrication memory + user review at submit time.
- **Privacy:** sessions + answers are local-only and git-ignored.
- **LinkedIn profile-read reliability/ToS:** profile sync is a one-shot, user-initiated read of the user's *own* page via their session; it may be blocked by anti-bot and is best-effort — on failure the profile is left unchanged. Kept assistive (read-only, review-and-merge), never a crawler.

## 12. Testing Strategy

- **Unit (TDD):** Application Details store (fields + memory accumulation, no-overwrite of id/timestamps), AI matcher (mocked engine: maps a question to a stored answer; drafts free-text; refuses to invent a factual answer → returns "ask user"), autofill orchestration with a **mocked Playwright page** (fills mapped fields, returns pending for unknowns, never calls submit).
- **Route tests (Supertest):** connections status/confirm/disconnect; application-details load/save; `/apply/start` and `/apply/answer` with a mocked browser/autofiller.
- **Manual:** the real Indeed Connect + one real assisted application end-to-end (selectors are inherently manual to verify, like scanning).

## 13. v1 Success Criteria

A user can: open **Connections** → **Connect Indeed** (log in once) → go to **Apply** → paste an Indeed job URL → the app opens it logged-in and fills contact fields + resume PDF + cover letter + known answers → answer any new questions once (remembered after) → **review the form and click Submit** — **without storing a password, without the app submitting for them, and without any fabricated answers.**
