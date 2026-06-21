# Phase 4.5 + 12 — CV Fit Score + Skill-Gap Learning Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When a tailored resume is generated, show a **fit score (A–F rendered as ★ out of 5)** and the **missing skills** for that job, and give each missing skill one-click **"Learn this free"** links to real search pages on reputable free learning platforms.

**Architecture:** Extend the existing documents engine so its single AI call also returns `fitScore` + `missingSkills` (it already has the profile + job, so assessing the *tailored* CV is free and reflects the improved resume — no extra call, no dependency on a prior evaluation). The route already spreads the engine result, so these flow through automatically. The front-end renders a fit card (stars + grade + skill chips with learning links) and persists the score with saved documents. Learning links are deterministic search URLs built client-side — no AI, no invented course URLs.

**Tech Stack:** Existing Node/Express + AI adapter + shared `lib/json.js`; React + Vite + Tailwind. Tests: Vitest + Supertest (server). Front-end verified by build + manual (consistent with prior phases).

---

## File Structure

```
server/
  documents/
    prompt.js              # MODIFY: ask for fitScore + missingSkills
    engine.js              # MODIFY: normalize fitScore (A–F coerce) + missingSkills
  __tests__/
    documents-engine.test.js  # MODIFY: assert fitScore + missingSkills
    api-documents.test.js     # MODIFY: generate stub + assertion includes fitScore/missingSkills
web/
  src/
    api.ts                 # MODIFY: DocumentDraft adds fitScore + missingSkills
    lib/skills.ts          # CREATE: gradeToStars() + learningLinks()
    pages/DocumentsPage.tsx# MODIFY: fit card (stars + missing skills + learn links); persist/load score
```

---

## Task 1: Documents engine returns fit score + missing skills

**Files:**
- Modify: `server/documents/prompt.js`, `server/documents/engine.js`
- Modify: `server/__tests__/documents-engine.test.js`, `server/__tests__/api-documents.test.js`

- [ ] **Step 1: Update the engine tests (write failing assertions first)**

In `server/__tests__/documents-engine.test.js`, REPLACE the first test (`returns resume and cover letter markdown from the engine JSON`) with this version, and ADD the coercion test after it (keep the other existing tests unchanged):
```js
  it('returns resume, cover letter, fit score and missing skills from the engine JSON', async () => {
    const engine = {
      generate: async () => JSON.stringify({
        resumeMarkdown: '# Jane\\nResume',
        coverLetterMarkdown: 'Dear Hiring Manager,',
        fitScore: 'B',
        missingSkills: ['SAP', 'IFRS'],
      }),
    };
    const docs = await generateDocuments(PROFILE, 'Accountant role', engine);
    expect(docs.resumeMarkdown).toContain('Jane');
    expect(docs.coverLetterMarkdown).toContain('Dear');
    expect(docs.fitScore).toBe('B');
    expect(docs.missingSkills).toEqual(['SAP', 'IFRS']);
  });

  it('coerces an invalid fit score to a safe grade and defaults missingSkills to []', async () => {
    const engine = { generate: async () => JSON.stringify({ resumeMarkdown: '# R', coverLetterMarkdown: 'C', fitScore: 'Z' }) };
    const docs = await generateDocuments(PROFILE, 'job', engine);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(docs.fitScore);
    expect(docs.missingSkills).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/documents-engine.test.js`
Expected: FAIL — `docs.fitScore` / `docs.missingSkills` are undefined.

- [ ] **Step 3: Update the prompt**

Replace the body of `buildDocumentsPrompt` in `server/documents/prompt.js` with:
```js
export function buildDocumentsPrompt(profile, jobText) {
  return `Using the candidate profile and the job description, write two documents AND assess fit.

1. A tailored, ATS-friendly RESUME in Markdown: concise, achievement-focused, naturally incorporating keywords from the job description. Reshape and emphasize ONLY what the profile already contains — do NOT invent experience, employers, dates, or qualifications.
2. A tailored COVER LETTER in Markdown: professional and specific to this role/company, 3-4 short paragraphs.
3. After tailoring, assess how well this tailored application fits the job: give an overall fit grade from A to F (A = excellent fit, F = poor fit), and list the important skills the job requires that are still MISSING from the candidate. Do NOT list skills the candidate already has, and do NOT invent skills.

Return JSON with EXACTLY these keys:
{
  "resumeMarkdown": string,
  "coverLetterMarkdown": string,
  "fitScore": "A" | "B" | "C" | "D" | "F",
  "missingSkills": string[]
}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile)}

JOB DESCRIPTION:
"""
${jobText}
"""`;
}
```
(Keep `DOC_SYSTEM` unchanged.)

- [ ] **Step 4: Update the engine normalization**

In `server/documents/engine.js`, replace the `normalizeDocuments` function with:
```js
const GRADES = ['A', 'B', 'C', 'D', 'F'];

function coerceGrade(g) {
  const up = String(g || '').trim().toUpperCase();
  return GRADES.includes(up) ? up : 'C';
}

function normalizeDocuments(raw = {}) {
  return {
    resumeMarkdown: typeof raw.resumeMarkdown === 'string' ? raw.resumeMarkdown : '',
    coverLetterMarkdown: typeof raw.coverLetterMarkdown === 'string' ? raw.coverLetterMarkdown : '',
    fitScore: coerceGrade(raw.fitScore),
    missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills.map(String) : [],
  };
}
```
(The empty-content guard in `generateDocuments` still checks only `resumeMarkdown`/`coverLetterMarkdown` — leave it unchanged.)

- [ ] **Step 5: Run the engine tests to verify they pass**

Run: `npx vitest run server/__tests__/documents-engine.test.js`
Expected: PASS.

- [ ] **Step 6: Update the API test to cover the passthrough**

In `server/__tests__/api-documents.test.js`, in the test `POST /api/documents/generate returns tailored markdown from pasted jobText`, update the `stubGemini(...)` call and add two assertions:
```js
    stubGemini(JSON.stringify({ resumeMarkdown: '# Jane', coverLetterMarkdown: 'Dear team', fitScore: 'A', missingSkills: ['SAP'] }));
```
and after the existing `expect(res.body.jobTitle).toBe('Accountant');` line add:
```js
    expect(res.body.fitScore).toBe('A');
    expect(res.body.missingSkills).toEqual(['SAP']);
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS — all server tests green (fit score flows through the route automatically).

- [ ] **Step 8: Commit**

```bash
git add server/documents/prompt.js server/documents/engine.js server/__tests__/documents-engine.test.js server/__tests__/api-documents.test.js
git commit -m "feat: documents engine returns fit score + missing skills"
```

---

## Task 2: Front-end — fit card (★/5) + missing skills + free learning links

**Files:**
- Modify: `web/src/api.ts`
- Create: `web/src/lib/skills.ts`
- Modify: `web/src/pages/DocumentsPage.tsx`

- [ ] **Step 1: Extend the DocumentDraft type**

In `web/src/api.ts`, update the `DocumentDraft` interface to add the two fields (keep `DocumentRecord extends DocumentDraft` as-is so records inherit them):
```ts
export interface DocumentDraft {
  resumeMarkdown: string;
  coverLetterMarkdown: string;
  jobTitle: string;
  company: string;
  evaluationId: string | null;
  fitScore: string;
  missingSkills: string[];
}
```

- [ ] **Step 2: Create the skills helper**

`web/src/lib/skills.ts`:
```ts
export function gradeToStars(grade: string): number {
  const map: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  return map[(grade || '').toUpperCase()] ?? 3;
}

export interface LearningLink {
  label: string;
  url: string;
}

// Deterministic, real search pages on reputable free platforms — never invented course URLs.
export function learningLinks(skill: string): LearningLink[] {
  const q = encodeURIComponent(skill.trim());
  return [
    { label: 'YouTube', url: `https://www.youtube.com/results?search_query=learn+${q}+free` },
    { label: 'freeCodeCamp', url: `https://www.freecodecamp.org/news/search/?query=${q}` },
    { label: 'Microsoft Learn', url: `https://learn.microsoft.com/en-us/search/?terms=${q}` },
    { label: 'Coursera', url: `https://www.coursera.org/search?query=${q}` },
  ];
}
```

- [ ] **Step 3: Wire the fit data into DocumentsPage state and persistence**

In `web/src/pages/DocumentsPage.tsx`:

(a) Add the import at the top (with the other imports):
```tsx
import { gradeToStars, learningLinks } from '../lib/skills';
```

(b) Add two state hooks (next to the other `useState` calls):
```tsx
  const [fitScore, setFitScore] = useState('');
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
```

(c) In `onGenerate`, after `setCompany(draft.company);` add:
```tsx
      setFitScore(draft.fitScore);
      setMissingSkills(draft.missingSkills ?? []);
```

(d) In `onSave`, change the `payload` to include the fit data:
```tsx
      const payload = { jobTitle, company, evaluationId: evalId || null, resumeMarkdown: resume, coverLetterMarkdown: cover, fitScore, missingSkills };
```

(e) In `loadDoc`, after `setCover(d.coverLetterMarkdown);` add:
```tsx
    setFitScore(d.fitScore ?? '');
    setMissingSkills(d.missingSkills ?? []);
```

- [ ] **Step 4: Render the fit card**

In `web/src/pages/DocumentsPage.tsx`, immediately AFTER the `{message && (...)}` block and BEFORE the `{hasContent && (` editors grid, insert this block:
```tsx
      {hasContent && fitScore && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800">Fit for this job</h2>
            <span className="text-amber-500 text-lg" aria-label={`${gradeToStars(fitScore)} out of 5`}>
              {'★'.repeat(gradeToStars(fitScore))}
              {'☆'.repeat(5 - gradeToStars(fitScore))}
            </span>
            <span className="text-sm text-slate-500">({fitScore})</span>
          </div>
          {missingSkills.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-700">Skills to add — and where to learn them free:</p>
              <ul className="mt-2 space-y-2">
                {missingSkills.map((s) => (
                  <li key={s} className="text-sm">
                    <span className="font-medium text-slate-800">{s}</span>
                    <span className="ml-2 space-x-3">
                      {learningLinks(s).map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          {l.label}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-green-700">No major skill gaps — strong match! 🎯</p>
          )}
        </div>
      )}
```

- [ ] **Step 5: Build to typecheck**

Run: `npm --prefix web run build`
Expected: builds with ZERO TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/api.ts web/src/lib/skills.ts web/src/pages/DocumentsPage.tsx
git commit -m "feat: show CV fit score (stars) + missing skills with free learning links"
```

- [ ] **Step 7: Manual acceptance**

- `npm --prefix web run build` then `NO_OPEN=1 node server/index.js &` → open `http://localhost:5123/documents` (setup complete + a profile).
- Generate documents for a job (requires a working AI engine). Confirm a **Fit for this job** card appears with a ★/5 rating + grade letter, and a **missing-skills** list where each skill has YouTube / freeCodeCamp / Microsoft Learn / Coursera links that open real search pages.
- Click a learning link → it opens a relevant search on that platform (real URL, not a dead/invented link).
- Save → reopen the saved document from the list → the fit score + missing skills reload.
- Stop the server.

---

## Self-Review

**1. Spec coverage (roadmap Phase 4.5 + Phase 12):**
- Phase 4.5 "fit score (A–F → ★/5) + missing skills on generated CV" → Task 1 (engine returns them), Task 2 Step 4 (stars + grade + skills card). ✓
- Phase 4.5 "score reflects the tailored CV" → engine assesses *after* tailoring in the same call. ✓
- Phase 12 "free learning links per missing skill, real search pages not invented URLs" → Task 2 Step 2 (`learningLinks` deterministic search URLs) + Step 4 render. ✓
- Acceptance (score shown; learn links open real pages) → Task 2 Step 7. ✓

**2. Placeholder scan:** No TBD/TODO; all code complete.

**3. Type consistency:** Engine returns `{resumeMarkdown, coverLetterMarkdown, fitScore, missingSkills}`; route spreads it; `DocumentDraft` (Task 2 Step 1) adds `fitScore: string` + `missingSkills: string[]`, inherited by `DocumentRecord`. `gradeToStars`/`learningLinks` (Task 2 Step 2) consume `fitScore`/each skill. `onSave` persists them; `loadDoc` restores with `?? ''`/`?? []` guards for older saved docs. `coerceGrade` keeps `fitScore` within A–F so `gradeToStars` always maps. ✓

No issues found.
