## PR E — 4th CV template (Executive) + live preview photo upload

### What changed
- **4th template: Executive** (`web/src/features/cv/cvTypes.ts`, `CvTemplates.tsx`). Compact two-column layout with a dark header rule, sidebar (skills/languages/certs) and main column (profile/experience/education/projects). Joins Classic, Modern, Minimal.
- **Live preview already wired** — `CvExportModal` reads `profile` live and renders `<CvDocument>`, so all 4 templates update as you edit. This PR just adds the 4th option to the switcher (`CV_TEMPLATES`).
- **Photo upload** (`ProfilePage.tsx` BasicsCard + `api.ts`): a "Photo (preview only)" control sets `profile.photo` to a session-local object URL (blob:/data:). Shown in the on-screen preview (Executive template uses a circular headshot).
- **Honesty/ATS guard**: the photo is explicitly NOT embedded in the downloaded PDF/Word. GCC ATS parsers strip photos anyway, and the export writers are content-only by design (cloud-safe, no image embedding). In-product notes state this in both the editor and the export modal footer. `saveProfile` strips `photo` before POST so a dead blob: URL is never persisted.

### Verification
- `cd web && npm run build` → passes (tsc + vite, no errors; `api.ts` edit safe).
- `npx vitest run` → 401/401 pass.
- Manual expectation: open CV export modal → 4 template chips (Classic/Modern/Minimal/Executive); Executive shows the headshot from the editor's Photo field; downloads remain photo-free.

### Note for review
Photo is preview-only by decision, not a gap. If you later want photos IN the PDF/Word, that needs real image-XObject embedding in `pdfWriter.js`/`cvDocx.js` (currently out of scope, text-only). Flag if you want that as a follow-up.

Agent did NOT merge (per workflow). After merge: `npx vercel deploy --prod --yes`, verify https://jobs4uae.vercel.app/api/health, and hard-refresh the app to clear the cached JS bundle.
