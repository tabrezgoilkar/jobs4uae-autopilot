import { useEffect, useState } from 'react';
import { getConfig, saveConfig, testAI, type AppConfig, type EngineId, type ApplicationDetails } from '../api';
import { Card, PageHeader, Button } from '../components/ui';

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-xs font-medium text-ink-secondary';

// The three friendly engine choices in the design.
const ENGINES: { id: EngineId; title: string; blurb: string }[] = [
  { id: 'gemini', title: 'Gemini free tier', blurb: 'Best quality for free · daily limits' },
  { id: 'byok', title: 'Free models (OpenRouter)', blurb: 'Auto-finds & rotates free models' },
  { id: 'ollama', title: 'Local AI (Ollama)', blurb: '100% offline · runs on your PC' },
];

export default function SettingsPage() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [engine, setEngine] = useState<EngineId>('gemini');
  const [status, setStatus] = useState<{ ok?: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState<ApplicationDetails>({});
  const [detailsSaved, setDetailsSaved] = useState(false);

  useEffect(() => {
    getConfig().then((c) => {
      setCfg(c);
      setEngine(c.engine ?? 'gemini');
      setDetails(c.applicationDetails ?? {});
    }).catch(() => {});
  }, []);

  if (!cfg) return <div className="text-ink-muted text-sm">Loading…</div>;

  function patch<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
    setStatus(null);
    setSaved(false);
  }

  function engineBody() {
    return { engine, gemini: cfg!.gemini, byok: cfg!.byok, ollama: cfg!.ollama };
  }

  async function onTest() {
    setBusy(true); setStatus(null);
    try {
      setStatus(await testAI(engineBody()));
    } catch {
      setStatus({ ok: false, message: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEngine() {
    setBusy(true); setStatus(null);
    try {
      const next = await saveConfig({ ...engineBody(), setupComplete: true });
      setCfg(next);
      setSaved(true);
    } catch {
      setStatus({ ok: false, message: 'Could not save settings.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails() {
    try {
      const next = await saveConfig({ applicationDetails: details });
      setCfg(next);
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2500);
    } catch { /* non-critical */ }
  }

  async function onRestartSetup() {
    await saveConfig({ setupComplete: false });
    window.location.reload();
  }

  return (
    <div className="space-y-4 max-w-[760px]">
      <PageHeader title="Settings" subtitle="All free. Switch the AI engine any time — your work is unaffected." />

      {/* AI engine */}
      <Card title="AI engine">
        <div className="flex flex-col gap-2.5">
          {ENGINES.map((e) => {
            const sel = engine === e.id;
            return (
              <button
                key={e.id}
                onClick={() => { setEngine(e.id); setStatus(null); setSaved(false); }}
                className={`j4u-press flex items-center gap-3 border rounded-[11px] px-3.5 py-3 text-left ${sel ? 'border-primary-600 bg-primary-50' : 'border-hair bg-surface'}`}
              >
                <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${sel ? 'border-primary-600' : 'border-hair-strong'}`}>
                  {sel && <span className="w-2 h-2 rounded-full bg-primary-600" />}
                </span>
                <span className="flex-1">
                  <span className="block text-[13.5px] font-bold text-ink-strong">{e.title}</span>
                  <span className="block text-xs text-ink-muted">{e.blurb}</span>
                </span>
                {cfg.engine === e.id && <span className="text-[11.5px] text-success-text font-mono">● active</span>}
              </button>
            );
          })}
        </div>

        {/* engine-specific fields */}
        <div className="mt-4 space-y-3">
          {engine === 'gemini' && (
            <label className="block"><span className={LABEL}>Gemini API key</span>
              <input type="password" autoComplete="off" className={FIELD} value={cfg.gemini.apiKey}
                onChange={(e) => patch('gemini', { ...cfg.gemini, apiKey: e.target.value })}
                placeholder="Paste your free key from aistudio.google.com" />
            </label>
          )}
          {engine === 'byok' && (
            <>
              <label className="block"><span className={LABEL}>API base URL</span>
                <input className={FIELD} value={cfg.byok.baseUrl}
                  onChange={(e) => patch('byok', { ...cfg.byok, baseUrl: e.target.value })}
                  placeholder="https://openrouter.ai/api/v1" />
              </label>
              <label className="block"><span className={LABEL}>API key</span>
                <input type="password" autoComplete="off" className={FIELD} value={cfg.byok.apiKey}
                  onChange={(e) => patch('byok', { ...cfg.byok, apiKey: e.target.value })} />
              </label>
              <label className="block"><span className={LABEL}>Model <span className="text-ink-muted">(use "auto" to find & rotate free models)</span></span>
                <input className={FIELD} value={cfg.byok.model}
                  onChange={(e) => patch('byok', { ...cfg.byok, model: e.target.value })}
                  placeholder="auto" />
              </label>
            </>
          )}
          {engine === 'ollama' && (
            <>
              <label className="block"><span className={LABEL}>Ollama base URL</span>
                <input className={FIELD} value={cfg.ollama.baseUrl}
                  onChange={(e) => patch('ollama', { ...cfg.ollama, baseUrl: e.target.value })} />
              </label>
              <label className="block"><span className={LABEL}>Local model name</span>
                <input className={FIELD} value={cfg.ollama.model}
                  onChange={(e) => patch('ollama', { ...cfg.ollama, model: e.target.value })} />
              </label>
            </>
          )}
        </div>

        {status && (
          <div role="status" className={`mt-3 text-sm rounded-lg p-3 border ${status.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
            {status.message}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" onClick={onTest} disabled={busy}>{busy ? 'Testing…' : 'Test AI'}</Button>
          <Button onClick={onSaveEngine} disabled={busy}>Save engine</Button>
          {saved && <span className="text-xs text-success-text">Saved.</span>}
        </div>
      </Card>

      {/* Application details & answer memory */}
      <Card title="Application details & answer memory">
        <p className="text-[12.5px] text-ink-muted -mt-1 mb-3">
          Standard GCC answers the copilot reuses when filling forms. <b className="text-ink-secondary">Facts are never invented</b> — only filled from here or asked once.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block"><span className={LABEL}>Nationality</span>
            <input className={FIELD} value={details.nationality ?? ''} onChange={(e) => { setDetails({ ...details, nationality: e.target.value }); setDetailsSaved(false); }} placeholder="e.g. Indian" />
          </label>
          <label className="block"><span className={LABEL}>Visa status</span>
            <input className={FIELD} value={details.visaStatus ?? ''} onChange={(e) => { setDetails({ ...details, visaStatus: e.target.value }); setDetailsSaved(false); }} placeholder="e.g. Employment visa (transferable)" />
          </label>
          <label className="block"><span className={LABEL}>Notice period</span>
            <input className={FIELD} value={details.noticePeriod ?? ''} onChange={(e) => { setDetails({ ...details, noticePeriod: e.target.value }); setDetailsSaved(false); }} placeholder="e.g. 30 days" />
          </label>
          <label className="block"><span className={LABEL}>Expected salary</span>
            <input className={FIELD} value={details.expectedSalary ?? ''} onChange={(e) => { setDetails({ ...details, expectedSalary: e.target.value }); setDetailsSaved(false); }} placeholder="e.g. AED 18,000 / mo" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={onSaveDetails}>Save details</Button>
          {detailsSaved && <span className="text-xs text-success-text">Saved.</span>}
        </div>
        <p className="mt-3 text-[11.5px] text-ink-muted">More remembered answers (relocation, driving licence, languages…) build up automatically as you use Assisted Apply.</p>
      </Card>

      {/* Privacy */}
      <Card>
        <div className="flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          <div className="text-sm font-bold text-ink-strong">Privacy</div>
        </div>
        <p className="text-[12.5px] text-ink-secondary leading-relaxed mt-2.5">
          Your CV, answers, and API keys live only on this PC (local files, git-ignored). The app never auto-submits
          applications, and only ever reads your own LinkedIn profile, with your session, for review-and-merge.
        </p>
        <Button variant="secondary" size="sm" className="mt-3.5" onClick={onRestartSetup}>Re-run setup wizard</Button>
      </Card>

      {/* Help & feedback */}
      <Card title="Help & feedback">
        <p className="text-[12.5px] text-ink-muted -mt-1 mb-3.5">
          Got an idea or hit a snag? It goes straight to the project on GitHub — the community fixes boards and ships features there.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="https://github.com/tabrezgoilkar/jobs4uae-autopilot/issues/new?labels=enhancement&title=Feature%20request:%20" target="_blank" rel="noopener" className="j4u-press flex gap-3 items-start border border-hair-subtle rounded-[11px] p-3.5 no-underline">
            <span className="w-9 h-9 flex-none rounded-[9px] bg-ai-soft flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ai-600)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>
            </span>
            <span><span className="block text-[13.5px] font-bold text-ink-strong">Request a feature</span><span className="block text-[11.5px] text-ink-muted mt-0.5">Opens a GitHub issue tagged enhancement</span></span>
          </a>
          <a href="https://github.com/tabrezgoilkar/jobs4uae-autopilot/issues/new?labels=bug&title=Issue:%20" target="_blank" rel="noopener" className="j4u-press flex gap-3 items-start border border-hair-subtle rounded-[11px] p-3.5 no-underline">
            <span className="w-9 h-9 flex-none rounded-[9px] bg-danger-soft flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="6" width="8" height="12" rx="4" /><path d="M19 7l-2 2M5 7l2 2M3 13h3M18 13h3M19 18l-2-2M5 18l2-2" /></svg>
            </span>
            <span><span className="block text-[13.5px] font-bold text-ink-strong">Report an issue</span><span className="block text-[11.5px] text-ink-muted mt-0.5">Opens a GitHub issue tagged bug</span></span>
          </a>
        </div>
      </Card>
    </div>
  );
}
