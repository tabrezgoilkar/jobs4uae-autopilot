# Research: MadsLorentzen/ai-job-search — reusable logic for jobs4uae-autopilot

**Source:** https://github.com/MadsLorentzen/ai-job-search (MIT, Python/Bun/LaTeX + Claude Code prompts)
**Date:** 2026-07-09
**Author:** Hermes Agent

## TL;DR

This repo is a **prompt-driven Claude Code workflow** (not a library), so there is no drop-in code to import into
our Node/TS/React/Vercel stack. BUT it encodes several **battle-tested frameworks and two country-agnostic TS/Bun
job-search CLIs** that map directly onto work we're already doing (UAE scraping, fit evaluation, tracker).

Highest-value, directly portable items:
1. **`linkedin-search` CLI** — hits LinkedIn's unauthenticated `jobs-guest` API. We already scrape LinkedIn; this
   is a cleaner, more stable approach (the `jobs-guest` endpoint returns structured-ish HTML designed for the public
   job board). Replaces hand-rolled scraping with a proven parser. **UAE-relevant** via `-l "Dubai, UAE"` / `Remote`.
2. **`freehire-search` CLI** — unauthenticated REST API (JSON, no key), multi-market, tech-focused. Gives us a
   *second* UAE/remote source for free. Self-hostable (`FREEHIRE_API_URL`).
3. **The 5-dimension fit-scoring framework** (`04-job-evaluation.md`) — we have `EvaluatePage.tsx` but no shared
   weighted scoring model. Porting this gives a consistent score + verdict + thresholds.
4. **`/upskill` gap-analysis algorithm** — skill-frequency × fit-weight heatmap. We have a tracker
   (`trackerApi.ts`) but no gap analysis; this is a ready-made method.
5. **Drafter→Reviewer + ATS/PDF verification loop** — relevant to our `AutoApplyPage.tsx` roadmap.

Lower-value / not portable: the LaTeX CV/cover-letter compilation, Danish portals, Claude-Code command plumbing.

---

## 1. `linkedin-search` CLI (MOST portable — recommended)

Path: `.agents/skills/linkedin-search/cli/src/`
- **Endpoint:** `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` (search) and
  `.../jobPosting/<id>` (detail). No auth, public.
- **Robust `htmlFetch`** (`helpers.ts`): real Chrome UA, `X-Requested-With: XMLHttpRequest`, exponential backoff on
  429/5xx (6 retries, cap 8s + jitter), returns `""` on 404, throws on other non-2xx. **We should lift this verbatim**
  — our current scraper's retry/backoff logic is weaker.
- **`parseJobCards`** splits the HTML on `data-entity-urn="urn:li:jobPosting:` and parses each chunk independently so
  one bad card can't break the batch. Extracts id/title/company/companyUrl/location/date/url via stable class hooks
  (`base-search-card__title`, `base-search-card__subtitle`, `job-search-card__location`, `job-search-card__listdate`).
- **`parseJobDetail`** extracts description (keeps `<br>`/block breaks as newlines), seniority/employmentType/
  jobFunction/industries from `description__job-criteria-*`, and `applyUrl`.
- **`decodeHtmlEntities` / `clean`** helpers handle numeric + named entities and strip tags — reusable as-is.
- **Query builder:** `keywords`, `location`, `f_TPR` (job age → `r<days*86400>`), `f_WT` (1 onsite / 2 remote / 3
  hybrid), `start` pagination (10/page).

**Why it matters for us:** We already scrape LinkedIn (memory: "LinkedIn: public profile pages ARE fetchable
server-side … but walls datacenter/cloud IPs (HTTP 999/403)"). The `jobs-guest` *job search* endpoint is a different,
more permissive surface than profile pages. Combined with our existing 4-tier cascade (server → local browser →
bookmarklet → screenshots), this gives a much more reliable LinkedIn **jobs** feed. Note: the repo itself warns
automated LinkedIn access is against ToS — personal/low-volume use only, and from a residential IP (our Tier-2 local
browser is exactly that).

**Porting effort:** ~1 day. Copy `helpers.ts` + `search.ts`/`detail.ts` logic into `server/scraper/linkedin/` (or a
new `lib/jobsApi/`). Wire to our existing retry/UA conventions. Add `-l "Dubai, UAE"` and `-l "Remote"` defaults for
UAE. Tests already exist in their `tests/` (parsing + flag validation) — port those too.

## 2. `freehire-search` CLI (second free source — recommended)

Path: `.agents/skills/freehire-search/cli/src/`
- **Endpoint:** `https://freehire.dev/api/v1/jobs/search` (envelope `{data, meta, error}`). No key. Self-host via
  `FREEHIRE_API_URL`.
- Backoff logic identical to linkedin (shared pattern).
- **Structured output** — no HTML parsing: `toResult`/`toDetail` reshape `{public_slug, company, location, skills[],
  work_mode, regions[], countries[], cities[], posted_at, enrichment{salary_min/max/currency, seniority, category,
  employment_type}}` into a clean `JobResult`.
- Rich **facet filters**: `regions`, `countries`, `cities`, `seniority`, `category`, `skills`, `work_mode`,
  `company_slug`, plus a generic `--facet` escape hatch. `posted_within_days`, `semantic_ratio=0` (keyword mode).

**Why it matters:** freehire is tech-focused and multi-market; with `--country AE` / `--region` / `--remote` we get
UAE tech jobs as clean JSON at zero cost. It's a natural second pipeline alongside Bayt + LinkedIn to increase
coverage and cross-validate.

**Porting effort:** ~0.5 day (it's JSON, trivial reshape). Add as a fetcher in our scraper aggregator.

## 3. Fit-scoring framework (`04-job-evaluation.md`)

Five dimensions, 0–100 each:
1. Technical Skills Match (weight 30%)
2. Experience Match (25%)
3. Behavioral/Culture Fit (15%)
4. Location & Logistics (Pass/Fail deal-breaker)
5. Career Alignment & Motivation (30%)

Plus optional Salary Benchmark (calls `salary_lookup.py`). Verdict thresholds: Strong (75+), Good (60–74),
Moderate (45–59), Weak (30–44), Poor (<30). Deal-breakers veto; deadlines get urgency flags.

**Why it matters:** We have `EvaluatePage.tsx` (fit evaluation UI exists) but no shared weighted model or
consistent verdict/thresholds. Porting this framework gives every evaluation the same score, the same verdict
language, and a defensible weighting. Directly enhances `EvaluatePage` + the evaluation we store on an `Application`
(`evaluationId` in `trackerApi.ts`).

**Porting effort:** ~1 day (encode the 5 dimensions + weights + thresholds as a pure TS function
`scoreFit(posting, profile)`; render the same table). Keep the salary benchmark optional (we don't have
`salary_lookup.py` data, but could wire Glassdoor/our own later).

## 4. `/upskill` skill-gap analysis (algorithm, portable)

- **Aggregate mode:** read tracked applications (`role`, `sector`, `notes`, `fit_rating`), build a skill-frequency
  map, weight each skill by `(100 - fit_rating)/100` (low-fit jobs surface more gaps), diff against the candidate
  profile, drop already-owned skills.
- **Targeted mode:** diff a single posting's required/preferred skills vs profile.
- **Pass 2 LLM synthesis** for domain/soft/tooling/credential gaps the hard diff misses (tagged `[domain]`/
  `[soft]`/`[tooling]`/`[credential]`).
- Output: prioritized **gap heatmap** (Critical/High/Medium/Low) + **learning plan** (WebSearch resources with the
  current year, study direction, time estimates) + **suggested study order** (dependencies first).

**Why it matters:** We have a tracker (`Application` with `status`) but no gap analysis. This algorithm is a
ready-made, profile-aware method to turn tracked jobs into "what should I learn" — a strong differentiator for
jobs4uae. The hard-diff part is pure logic; the learning-plan part needs web search (our AI engine can do it).

**Porting effort:** ~2 days for the hard-diff + heatmap as a server route + UI; the learning-plan WebSearch part is
optional Phase 2.

## 5. `/apply` drafter→reviewer + ATS/PDF loop (roadmap, relevant to AutoApply)

- Two-agent pipeline: **drafter** writes CV+cover letter; **reviewer** (fresh context, company research) critiques;
  drafter revises. Token-efficient (pass drafts inline, run verification checklist once).
- **PDF verification loop:** compile (lualatex/xelatex) and visually inspect; fix orphaned titles, page spills,
  font fallbacks with `\needspace`/`\enlargethispage`.
- **ATS text-layer check:** `pdftotext`, verify contact details/reading order/keyword coverage as a parser sees it;
  honest rule — never stuff keywords the profile doesn't support.
- **Relevance-weighted CV cutting** when over page limit: score each line by (relevance × uniqueness × cover-letter
  dependency), cut lowest first.

**Why it matters:** Our `AutoApplyPage.tsx` is the natural home. We don't use LaTeX (we generate docs another way),
but the *process* — draft, independent review, honest ATS-style check, relevance-weighted trimming — is exactly what
a good auto-apply should do. The "never fabricate" + "reviewer with fresh context" principles match our existing
honesty constraints.

**Porting effort:** design-level; reuse the *principles*, not the LaTeX. Our doc generation is different, so this is
a pattern to follow when building AutoApply, not code to copy.

---

## What we should NOT port
- **Danish portals** (`jobindex/jobnet/jobbank/jobdanmark`) — country-specific, and we target UAE.
- **LaTeX CV/cover-letter engine** — we don't compile LaTeX; our doc pipeline is different.
- **Claude Code command/skill plumbing** (`.claude/commands/*.md`, SKILL.md) — that's the orchestration layer for a
  different agent runtime. We have our own API + React UI.
- **`salary_lookup.py` + Excel tooling** — needs BYO salary data; skip unless we source UAE salary data later.

## Suggested next steps (priority order)
1. **Port `linkedin-search` jobs-guest parser** into our scraper (highest reliability win for LinkedIn jobs, UAE via
   location flag). ~1 day.
2. **Add `freehire-search` as a second JSON source** (UAE tech/remote). ~0.5 day.
3. **Encode the 5-dimension fit framework** as `scoreFit()` and wire into `EvaluatePage` + stored evaluation. ~1 day.
4. **Build the `/upskill` gap-heatmap** from our tracker as a new page/route. ~2 days (Phase 2).
5. **Adopt the drafter→reviewer + honest ATS-check principles** when implementing `AutoApplyPage`. Design only.

## Evidence / files read
- README.md, CLAUDE.md structure
- `.claude/skills/job-application-assistant/04-job-evaluation.md` (fit framework)
- `.agents/skills/linkedin-search/cli/src/{helpers,commands/search,commands/detail}.ts` (jobs-guest API + parser)
- `.agents/skills/freehire-search/cli/src/{helpers,commands/search}.ts` (REST API + facet reshape)
- `.claude/skills/upskill/SKILL.md` (gap-analysis algorithm)
- `.claude/commands/apply.md` (drafter-reviewer + ATS loop, first 60 lines)
- Our repo: `web/src/features/tracker/trackerApi.ts` (Application model), `EvaluatePage.tsx`, `AutoApplyPage.tsx`
