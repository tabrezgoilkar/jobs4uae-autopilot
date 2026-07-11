# Jobs4UAE Autopilot

A **free, private** job-search assistant for the **GCC region** (UAE, Qatar, Kuwait,
Bahrain, Saudi Arabia, Oman). Paste a job → get a clear "should I apply?" score →
generate a tailored resume + cover letter → scan GCC boards → track applications.

You can run it two ways:

- **Locally** on your own PC — everything works, fully private, no login, no cloud.
- **On the cloud** (Vercel) — a hosted version the whole community can use, with
  sign-in and per-user AI keys.

> Adapted from the developer-focused [`santifer/career-ops`](https://github.com/santifer/career-ops):
> same evaluation brain, a friendly clickable interface, a free AI engine, and a
> one-click Windows install.

---

## What you get

| Feature | Local (your PC) | Cloud (Vercel) |
|---|---|---|
| **Evaluate a job** (A–F "should I apply?" + instant fit score) | ✅ | ✅ |
| **Tailor resume + cover letter** (drafter → reviewer → honest ATS check) | ✅ | ✅ (needs your AI key) |
| **Scan GCC boards** (LinkedIn jobs-guest, FreeHire) | ✅ | ✅ |
| **Scan Indeed** (needs a headed browser) | ✅ | ❌ (no browser on serverless) |
| **Paste a job link → fetch it** | ✅ | ❌ (needs a browser) |
| **Auto-apply autofill** (you click Submit) | ✅ | ❌ (needs a browser) |
| **Email-apply compose** (mailto / Gmail link) | ✅ | ✅ |
| **Upskill plan** (gap heatmap from your tracker) | ✅ | ✅ |
| **Application tracker** | ✅ | ✅ (with a database) |
| **LinkedIn profile import** (Tier-1 URL + Tier-2 screenshot) | ✅ | Tier-1 only (Tier-2 needs a residential IP / browser) |
| **Privacy** | 100% on your machine | Per-user, isolated by Clerk sign-in |

The cloud build is **assisted, never automated**: it prepares everything, *you* review
and submit. It never applies on your behalf.

---

## Option A — Run it locally (recommended for most users)

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

## Option B — Deploy on the cloud (Vercel)

Use this if you want a hosted version the community can sign in to. The cloud build
runs as a Vercel serverless function (`api/index.js`) and serves the web app as static
files — **Playwright is not bundled**, so only the browser-free features are available
(see the table above).

### 1. Fork & import into Vercel
- Push this repo to your GitHub, then **New Project → Import** in Vercel.
- Framework preset: **Other** (the `vercel.json` already sets the build).
- `vercel.json` does:
  ```json
  {
    "installCommand": "npm install && npm install --prefix web",
    "buildCommand": "npm run build",
    "outputDirectory": "web/dist",
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api" },
      { "source": "/(.*)",    "destination": "/index.html" }
    ]
  }
  ```

### 2. Set the environment variables
Copy `.env.example` to `.env.local` (local preview) or add these in the Vercel dashboard
(**Settings → Environment Variables**). **All are required for a production deploy**
because auth is not allowed to fail open:

| Variable | What it is | Where to get it |
|---|---|---|
| `CLERK_SECRET_KEY` | Server-side Clerk auth | [clerk.com](https://clerk.com) → your app → API Keys |
| `CLERK_AUTHORIZED_PARTIES` | Comma-separated allowed frontend origin(s), e.g. `https://your-app.vercel.app` | your Vercel URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public Clerk key (browser) | same Clerk app → API Keys |
| `DATABASE_URL` | *(Optional)* Neon Postgres connection string for cross-request per-user storage | [neon.tech](https://neon.tech) — if omitted, the app uses a per-server store (fine for light use) |

> Without `CLERK_SECRET_KEY` the cloud app **refuses to boot in production** (it would
> otherwise silently share one account). In local dev (`NODE_ENV !== 'production'`) no
> Clerk key is needed and the app runs as the `local` user with no login.

### 3. Deploy
```bash
vercel --prod
```
or just push to `main` if you connected Git. Vercel runs `npm run build` (tsc + vite)
and bundles only the cloud-safe code.

### 4. Add your own AI keys (per user, in the app)
Cloud AI keys are **not** env vars — each signed-in user enters their own in the app:

1. Open the deployed URL and **sign in** (Clerk).
2. Go to **Settings → AI engine** (or the Setup Wizard on first run).
3. Pick **OpenRouter / Gemini / BYOK** and paste your key. It's stored per-account and
   never shared.

Once a key is set, **Evaluate**, **Auto-apply → Tailor CV**, and **Email-apply** all
work. The instant **fit score** and **Upskill plan** need no key.

---

## Project layout

```
server/            Express back end
  app.js           full desktop app (browser features enabled)
  cloudApp.js      cloud app (no Playwright in the module graph)
  index.js         local entry (npm start)
api/index.js       Vercel serverless entry → createCloudApp()
  apply/           drafter.js, reviewer.js, atsCheck.js (honest, no fabrication)
  scanner/         boards/ (linkedin, freehire, indeed), engine.js
  evaluate/        scoreFit.js (5-dimension weighted fit)
  upskill/         heatmap.js
  ai/              gemini / byok / ollama engines (createEngine)
web/               React + Vite front end (built to web/dist)
vercel.json        Vercel build + rewrite config
```

## Privacy & honesty
- **Local:** your CV/data stay on your machine (local SQLite + files). API keys are
  stored locally and never committed.
- **Cloud:** data is isolated per Clerk user; AI keys are per-account.
- The app **prepares** applications — **you** review and submit. It never auto-applies.
- The resume **ATS check is transparent** (shows present/missing keywords + parser
  warnings). It deliberately does **not** show a fake "98% match" score.
- Job-board scanning is best-effort and depends on each site's structure and terms.

## License
TBD (will be set before public release).
