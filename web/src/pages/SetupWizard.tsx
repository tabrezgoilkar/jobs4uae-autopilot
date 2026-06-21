import { useState } from 'react';
import { saveConfig, testAI, type AppConfig, type EngineId } from '../api';

const ENGINES: { id: EngineId; title: string; blurb: string }[] = [
  { id: 'gemini', title: 'Gemini (free)', blurb: 'Best quality for free. Needs internet + a free Google key.' },
  { id: 'byok', title: 'My own key', blurb: 'Use your own Claude / OpenAI / Gemini key.' },
  { id: 'ollama', title: 'Local AI (offline)', blurb: '100% private & offline. Needs a decent PC.' },
];

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-slate-800">Welcome to Jobs4UAE Autopilot</h1>
        <p className="mt-2 text-slate-600">Choose how you want the AI to work. All options are free.</p>

        <div className="mt-6 grid gap-3" role="radiogroup" aria-label="AI engine">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              role="radio"
              aria-checked={engine === e.id}
              onClick={() => selectEngine(e.id)}
              className={`text-left p-4 rounded-xl border-2 transition ${
                engine === e.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-semibold text-slate-800">{e.title}</div>
              <div className="text-sm text-slate-500">{e.blurb}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {engine === 'gemini' && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Gemini API key</span>
              <input
                type="password"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={cfg.gemini.apiKey}
                onChange={(ev) => setCfg({ ...cfg, gemini: { ...cfg.gemini, apiKey: ev.target.value } })}
                placeholder="Paste your free key from aistudio.google.com"
              />
            </label>
          )}
          {engine === 'byok' && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">API base URL</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.baseUrl}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, baseUrl: ev.target.value } })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.apiKey}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, apiKey: ev.target.value } })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Model</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  value={cfg.byok.model}
                  onChange={(ev) => setCfg({ ...cfg, byok: { ...cfg.byok, model: ev.target.value } })}
                />
              </label>
            </>
          )}
          {engine === 'ollama' && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Local model name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                value={cfg.ollama.model}
                onChange={(ev) => setCfg({ ...cfg, ollama: { ...cfg.ollama, model: ev.target.value } })}
              />
              <span className="text-xs text-slate-400">
                Automated install comes in a later phase. For now, install Ollama and run this model yourself.
              </span>
            </label>
          )}
        </div>

        {status && (
          <div className={`mt-4 text-sm rounded-lg p-3 ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {status.message}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onTest}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
          >
            {busy ? 'Testing…' : 'Test AI'}
          </button>
          <button
            onClick={onSave}
            disabled={busy || !status?.ok}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            Save & continue
          </button>
        </div>
        {!status?.ok && (
          <p className="mt-2 text-xs text-slate-400">Run "Test AI" successfully to enable Save.</p>
        )}
      </div>
    </div>
  );
}
