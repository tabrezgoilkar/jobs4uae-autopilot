# Jobs4UAE Autopilot

A **free, private, local** job-search assistant for the **GCC region** (UAE, Qatar, Kuwait, Bahrain, Saudi Arabia, Oman) — built for non-technical job seekers.

Paste a job → get a clear A–F "should I apply?" score → generate a tailored resume and cover letter → scan GCC job boards → track your applications. All on your own PC. **No cloud, no subscription, not a penny required.**

> Adapted from the developer-focused [`santifer/career-ops`](https://github.com/santifer/career-ops): same evaluation brain, a friendly clickable interface, a free AI engine, and a one-click Windows install.

## Why this exists

The original Career-Ops is excellent but requires a terminal, Node.js, git, hand-edited config files, and a paid AI coding subscription. This project makes the same power usable by **anyone in the GCC community** looking for a job, for free.

## How the AI works (you choose, all free options)

A setup wizard lets you pick:

- **Gemini free tier** *(default)* — best quality for free; needs internet + a one-time free key.
- **Bring your own key** — use your own Claude / OpenAI / Gemini key.
- **Local AI (Ollama)** — 100% offline & private; the app installs it for you (needs a decent PC).

## Status

🚧 Early development — built in 10 tested phases. See the design spec:
[`docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md`](docs/superpowers/specs/2026-06-21-gcc-career-copilot-design.md)

### Roadmap

1. Foundation + Setup Wizard
2. Profile & Resume Intake
3. Job Evaluation (A–F score)
4. Resume Tailoring + Cover Letter
5. PDF Export
6. Application Tracker
7. GCC Scanning — Bayt + Naukrigulf
8. GCC Scanning — GulfTalent + Indeed + local boards
9. LinkedIn (assisted) + Batch evaluation
10. Local LLM automation + Windows one-click packaging

## Privacy & honesty

- Your CV and data stay **on your machine** (local SQLite + files). API keys are stored locally and never committed.
- The app **prepares** applications — **you** review and submit. It never auto-applies on your behalf.
- Job-board scanning is provided on a best-effort basis and depends on each site's structure and terms.

## License

TBD (will be set before public release).
