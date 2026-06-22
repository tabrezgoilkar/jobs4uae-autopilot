import { useState } from 'react';
import { saveConfig, testAI, type AppConfig, type EngineId } from '../api';
import { Button } from '../components/ui';
import { IconSparkle } from '../components/icons';

const ENGINES: { id: EngineId; title: string; blurb: string }[] = [
  { id: 'gemini', title: 'Gemini (free)', blurb: 'Best quality for free. Needs internet + a free Google key.' },
  { id: 'byok', title: 'My own key', blurb: 'Use your own Claude / OpenAI / Gemini key.' },
  { id: 'ollama', title: 'Local AI (offline)', blurb: '100% private & offline. Needs a decent PC.' },
];

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-sm font-medium text-ink-secondary';

export default function SetupWizard({
  initial,
  onComplete,
}: {
  initial: AppConfig;
  onComplete: (c: AppConfig) => void;
}) {
  const [cfg, setCfg] = useState<AppConfig>(initial);
  const [engine, setEngine] = useState<EngineId>(initial.engine ?? 'gemini');
  const [status, setStatus] = useState<{ ok?: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function engineBody(): Record<string, unknown> {
    return { engine, gemini: cfg.gemini, byok: cfg.byok, ollama: cfg.ollama };
  }

  function selectEngine(id: EngineId) {
    if (id !== engine) {
      setEngine(id);
      setStatus(null);
    }
  }

  async function onTest() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await testAI(engineBody());
      setStatus(r);
    } catch {
      setStatus({ ok: false, message: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setBusy(true);
    try {
      const saved = await saveConfig({ ...engineBody(), setupComplete: true } as Partial<AppConfig>);
      if (!saved?.setupComplete) throw new Error('Save did not confirm completion');
      onComplete(saved);
    } catch {
      setStatus({ ok: false, message: 'Failed to save settings. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--canvas)' }}>
      <div className="w-full" style={{ maxWidth: 560 }}>
        <div className="flex items-baseline gap-1.5 justify-center mb-6 font-semibold text-ink-strong">
          <span className="relative text-[26px] tracking-tight">
            jobs4uae
            <span className="absolute" style={{ left: 14, top: -15 }}><IconSparkle size={15} color="var(--ai-600)" /></span>
          </span>
          <span className="text-base font-medium text-ink-muted">autopilot</span>
        </div>

        <div className="bg-surface border border-hair-subtle rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-ink-strong tracking-tight">Welcome to Jobs4UAE Autopilot</h1>
          <p className="mt-2 text-ink-secondary text-sm">Choose how you want the AI to work. All options are free.</p>

          <div className="mt-6 grid gap-3" role="radiogroup" aria-label="AI engine">
            {ENGINES.map((e) => {
              const sel = engine === e.id;
              return (
                <button
                  key={e.id}
                  role="radio"
                  aria-checked={sel}
                  onClick={() => selectEngine(e.id)}
                  className={`text-left p-4 rounded-xl border transition j4u-focus ${
                    sel ? 'border-primary-600 bg-primary-50' : 'border-hair hover:border-hair-strong bg-surface'
                  }`}
                >
                  <div className="font-semibold text-ink-strong">{e.title}</div>
                  <div className="text-sm text-ink-muted">{e.blurb}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            {engine === 'gemini' && (
              <label className="block">
                <span className={LABEL}>Gemini API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  value={cfg.gemini.apiKey}
                  onChange={(ev) => setCfg({ ...cfg, gemini: { ...cfg.gemini, apiKey: ev.target.value } })}
                  placeholder="Paste your free key from aistudio.google.com"
                />
              </label>
            )}
            {engine === 'byok' && (
              <>
                <label className="block">
                  <span className={LABEL}>API base URL</span>
                  <input className={FIELD} value={cfg.byok.baseUrl} onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, baseUrl: ev.target.value } })} />
                </label>
                <label className="block">
                  <span className={LABEL}>API key</span>
                  <input type="password" autoComplete="off" className={FIELD} value={cfg.byok.apiKey} onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, apiKey: ev.target.value } })} />
                </label>
                <label className="block">
                  <span className={LABEL}>Model</span>
                  <input className={FIELD} value={cfg.byok.model} onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, model: ev.target.value } })} />
                </label>
              </>
            )}
            {engine === 'ollama' && (
              <label className="block">
                <span className={LABEL}>Local model name</span>
                <input className={FIELD} value={cfg.ollama.model} onChange={(ev) => setCfg({ ...cfg, ollama: { ...cfg.ollama, model: ev.target.value } })} />
                <span className="text-xs text-ink-muted">
                  Automated install comes in a later phase. For now, install Ollama and run this model yourself.
                </span>
              </label>
            )}
          </div>

          {status && (
            <div role="status" className={`mt-4 text-sm rounded-lg p-3 border ${status.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
              {status.message}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={onTest} disabled={busy}>
              {busy ? 'Testing…' : 'Test AI'}
            </Button>
            <Button onClick={onSave} disabled={busy || !status?.ok}>
              Save &amp; continue
            </Button>
          </div>
          {!status?.ok && (
            <p className="mt-2 text-xs text-ink-muted">Run "Test AI" successfully to enable Save.</p>
          )}
        </div>
        <div className="text-center text-xs text-ink-muted mt-4">
          Adapted from the open-source career-ops · runs entirely on your machine
        </div>
      </div>
    </div>
  );
}
