# Jobs4UAE Autopilot

A **free, private** job-search assistant for the **GCC region** (UAE, Qatar, Kuwait,
Bahrain, Saudi Arabia, Oman). Paste a job → get a clear "should I apply?" score →
generate a tailored resume + cover letter → scan GCC boards → track applications.

Two ways to use it:

- **Locally** on your own PC — everything works, fully private, no login, no cloud.
- **On the cloud** — a hosted version the whole community can sign in to and use
  (you just open the URL and log in; no setup needed from you).

> Adapted from the developer-focused [`santifer/career-ops`](https://github.com/santifer/career-ops):
> same evaluation brain, a friendly clickable interface, a free AI engine, and a
> one-click Windows install.

---

## What you get

| Feature | Local (your PC) | Cloud (hosted) |
|---|---|---|
| **Evaluate a job** (A–F "should I apply?" + instant fit score) | ✅ | ✅ |
| **Tailor resume + cover letter** (drafter → reviewer → honest ATS check) | ✅ | ✅ (needs your AI key) |
| **Scan GCC boards** (LinkedIn jobs-guest, FreeHire) | ✅ | ✅ |
| **Scan Indeed** (needs a headed browser) | ✅ | ❌ (no browser on the hosted server) |
| **Paste a job link → fetch it** | ✅ | ❌ (needs a browser) |
| **Auto-apply autofill** (you click Submit) | ✅ | ❌ (needs a browser) |
| **Email-apply compose** (mailto / Gmail link) | ✅ | ✅ |
| **Upskill plan** (gap heatmap from your tracker) | ✅ | ✅ |
| **Application tracker** | ✅ | ✅ |
| **LinkedIn profile import** (Tier-1 URL + Tier-2 screenshot) | ✅ | Tier-1 only (Tier-2 needs a residential IP / browser) |
| **Privacy** | 100% on your machine | Per-user, isolated by your sign-in |

The app is **assisted, never automated**: it prepares everything, *you* review and
submit. It never applies on your behalf.

---

## Run it locally (your PC)

### 1. Prerequisites
- **Node.js ≥ 20** — https://nodejs.org
- (Optional) **Ollama** for 100% offline AI — https://ollama.com
- (Optional) **Playwright** browsers for Indeed scanning / autofill:
  ```bash
  npx playwright install chromium
  ```

### 2. Install & run
```bash
git clone https://github.com/tabrezgoilkar/jobs4uae-autopilot.git
cd jobs4uae-autopilot
npm install
npm run dev
```
This starts the server on **http://localhost:5123** and opens the web app on
**http://localhost:5173** automatically.

### 3. First launch — the Setup Wizard
The app opens a **Setup Wizard** where you pick a free AI engine (this is how the
*AI features* — tailoring, evaluation, draft — get their brain):

- **OpenRouter (free, recommended)** — paste a free key from
  [openrouter.ai/keys](https://openrouter.ai/keys); the app auto-picks and rotates a
  working `:free` model. No payment.
- **Gemini free tier** — best quality for free; needs a one-time free
  [Google AI Studio key](https://aistudio.google.com/apikey).
- **Bring your own key (BYOK)** — any OpenAI-compatible endpoint (OpenAI, Claude via
  OpenRouter/Anthropic proxy, etc.).
- **Local AI (Ollama)** — 100% offline & private; the app talks to your local Ollama.

Click **Test AI**, then **Save & continue**. Your choice is saved locally (git-ignored
`data/config.json`) and skipped on next launch. **No keys are ever committed.**

> Want to change the engine later? Open **Settings → AI engine** in the app.

### 4. Run the tests
```bash
npm test
```

---

## Use the cloud version (hosted)

You don't need to install or deploy anything — just open the hosted URL and sign in.

### 1. Open the app & sign in
Go to the hosted URL (e.g. the deployed Vercel app) and **sign in** with the
provided login (Clerk). Each account is isolated — your data and AI keys are yours
alone.

### 2. Add your own AI key (one time)
The cloud app needs an AI key for the *AI* features (tailoring, evaluation, draft).
The instant **fit score** and **Upskill plan** need no key.

1. After signing in, open **Settings → AI engine** (or the Setup Wizard on first run).
2. Pick **OpenRouter / Gemini / BYOK** and paste your key. It's stored per-account and
   never shared with anyone.
3. Click **Test AI** to confirm it works.

### 3. What you can do on the cloud
- **Evaluate** — paste a job, get an A–F "should I apply?" score plus an instant
  weighted fit breakdown (no key needed).
- **Scan GCC boards** — search **LinkedIn**, **FreeHire** and **Telegram community
  posts** directly (these need no browser). Indeed / paste-a-link / autofill are desktop-only (they need a browser,
  so use the local app for those).
- **Upskill plan** — see a gap heatmap of skills you're missing vs the jobs you've
  tracked.
- **Auto-apply → Email-apply** — generate a tailored application email and open it in
  Gmail / your mail client.
- **Auto-apply → Tailor CV** — generate a tailored resume + cover letter with a
  honesty review and an ATS checklist (needs your AI key).
- **Tracker** — save and track the applications you've sent.

> Anything that needs a headed browser (Indeed scan, paste-a-link fetch, autofill)
> is **not** available on the cloud build — run it **locally** for those.

---

## Community jobs from Telegram (POC)

Gulf jobs often surface first in Telegram/WhatsApp groups, not on job boards. This
POC taps one public source channel — [@WePostJobs](https://t.me/WePostJobs) — two ways:

1. **Scanner board** — the Scan page now includes a **Telegram (community)** source.
   It reads the channel's public web preview (`t.me/s/WePostJobs`, no login, no API
   key), keeps only posts that look like job ads, and turns them into normal
   listings (title, GCC location, apply email, link to the original post) so they
   get fit-scored and tailored like any other job. Override the source with
   `TELEGRAM_SOURCE_CHANNEL=<channel>`.

2. **Repost to your own group** — forward fresh job posts to your Telegram group via
   the official Bot API (create a bot with [@BotFather](https://t.me/BotFather), add
   it to your group as admin, grab the group chat id):

   ```bash
   # preview only — prints what would be sent
   npm run telegram:repost -- --dry-run

   # forward up to 5 new posts (dedupes across runs via data/telegram-repost-state.json)
   TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_CHAT_ID=-100123456789 npm run telegram:repost
   ```

   Every repost credits and links the original post. Only official APIs are used —
   no user-account automation, nothing is auto-posted without you running the
   command (schedule it with cron/Task Scheduler if you want a feed).

---

## Project layout

```
server/            Express back end
  app.js           full desktop app (browser features enabled)
  cloudApp.js      cloud app (no Playwright in the module graph)
  index.js         local entry (npm start)
  apply/           drafter.js, reviewer.js, atsCheck.js (honest, no fabrication)
  scanner/         boards/ (linkedin, freehire, indeed, telegram), engine.js
  community/       telegramRepost.js (forward channel jobs to your group)
  evaluate/        scoreFit.js (5-dimension weighted fit)
  upskill/         heatmap.js
  ai/              gemini / byok / ollama engines (createEngine)
web/               React + Vite front end (built to web/dist)
```

## Privacy & honesty
- **Local:** your CV/data stay on your machine (local SQLite + files). API keys are
  stored locally and never committed.
- **Cloud:** data is isolated per your sign-in; AI keys are per-account.
- The app **prepares** applications — **you** review and submit. It never auto-applies.
- The resume **ATS check is transparent** (shows present/missing keywords + parser
  warnings). It deliberately does **not** show a fake "98% match" score.
- Job-board scanning is best-effort and depends on each site's structure and terms.

## License
TBD (will be set before public release).
