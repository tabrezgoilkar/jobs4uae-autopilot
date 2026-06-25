import { useEffect, useState } from 'react';
import { getConfig, saveConfig, testAI, type AppConfig, type EngineId } from '../api';

const ENGINES: { id: EngineId; title: string; sub: string }[] = [
  { id: 'openrouter', title: 'Free models (OpenRouter)', sub: 'Auto-finds & rotates free models' },
  { id: 'gemini', title: 'Gemini free tier', sub: 'Best quality for free' },
  { id: 'byok', title: 'My own key', sub: 'Claude / OpenAI / compatible' },
  { id: 'ollama', title: 'Local AI (Ollama)', sub: '100% offline' },
];
const card = { background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 } as const;
const FIELD = 'w-full text-sm mt-1' as const;
const fieldStyle = { border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', background: 'var(--surface)', color: 'var(--text)' } as const;

export default function MobileSettings() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [engine, setEngine] = useState<EngineId>('openrouter');
  const [status, setStatus] = useState<{ ok?: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getConfig().then((c) => { setCfg(c); setEngine(c.engine ?? 'openrouter'); }).catch(() => {}); }, []);
  if (!cfg) return <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const body = () => ({ engine, gemini: cfg.gemini, openrouter: cfg.openrouter, byok: cfg.byok, ollama: cfg.ollama });
  async function onTest() {
    setBusy(true); setStatus(null);
    try { setStatus(await testAI(body())); } catch { setStatus({ ok: false, message: 'Could not reach the server.' }); }
    finally { setBusy(false); }
  }
  async function onSave() {
    setBusy(true);
    try { const saved = await saveConfig({ ...body(), setupComplete: true } as Partial<AppConfig>); setCfg(saved); setStatus({ ok: true, message: 'Saved.' }); }
    catch { setStatus({ ok: false, message: 'Save failed.' }); }
    finally { setBusy(false); }
  }
  async function reRunSetup() {
    if (!confirm('Re-run the setup wizard? Your data stays; you re-pick the AI engine.')) return;
    await saveConfig({ setupComplete: false } as Partial<AppConfig>);
    location.reload();
  }

  return (
    <div className="j4u-rise space-y-3.5">
      <div style={card}>
        <div className="text-[14px] font-bold" style={{ color: 'var(--text-strong)' }}>AI engine</div>
        <div className="text-[12px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>All free. Switch any time.</div>
        <div className="flex flex-col gap-2.5">
          {ENGINES.map((e) => {
            const active = engine === e.id;
            return (
              <button key={e.id} onClick={() => { setEngine(e.id); setStatus(null); }} className="j4u-press text-left flex items-center gap-2.5" style={{ border: `1.5px solid ${active ? 'var(--primary-600)' : 'var(--border)'}`, background: active ? 'var(--primary-50)' : 'var(--surface)', borderRadius: 11, padding: 12 }}>
                <span className="flex-none flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? 'var(--primary-600)' : 'var(--border)'}` }}>{active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-600)' }} />}</span>
                <span className="flex-1"><span className="block text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>{e.title}</span><span className="block text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{e.sub}</span></span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          {engine === 'openrouter' && <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>OpenRouter API key</span><input type="password" className={FIELD} style={fieldStyle} value={cfg.openrouter.apiKey} onChange={(e) => setCfg({ ...cfg, openrouter: { ...cfg.openrouter, apiKey: e.target.value } })} placeholder="openrouter.ai/keys" /></label>}
          {engine === 'gemini' && <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>Gemini API key</span><input type="password" className={FIELD} style={fieldStyle} value={cfg.gemini.apiKey} onChange={(e) => setCfg({ ...cfg, gemini: { ...cfg.gemini, apiKey: e.target.value } })} placeholder="aistudio.google.com" /></label>}
          {engine === 'byok' && (<>
            <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>API base URL</span><input className={FIELD} style={fieldStyle} value={cfg.byok.baseUrl} onChange={(e) => setCfg({ ...cfg, byok: { ...cfg.byok, baseUrl: e.target.value } })} /></label>
            <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>API key</span><input type="password" className={FIELD} style={fieldStyle} value={cfg.byok.apiKey} onChange={(e) => setCfg({ ...cfg, byok: { ...cfg.byok, apiKey: e.target.value } })} /></label>
            <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>Model</span><input className={FIELD} style={fieldStyle} value={cfg.byok.model} onChange={(e) => setCfg({ ...cfg, byok: { ...cfg.byok, model: e.target.value } })} /></label>
          </>)}
          {engine === 'ollama' && <label className="block"><span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>Local model</span><input className={FIELD} style={fieldStyle} value={cfg.ollama.model} onChange={(e) => setCfg({ ...cfg, ollama: { ...cfg.ollama, model: e.target.value } })} /></label>}
        </div>

        {status && <div className="text-[12.5px] rounded-md p-2.5 mt-3" style={{ background: status.ok ? 'var(--success-soft)' : 'var(--danger-soft)', color: status.ok ? 'var(--success-text)' : 'var(--danger-text)' }}>{status.message}</div>}
        <div className="flex gap-2 mt-3">
          <button onClick={onTest} disabled={busy} className="j4u-press flex-1 h-10 rounded-[10px] text-[12.5px] font-semibold" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)' }}>{busy ? 'Testing…' : 'Test AI'}</button>
          <button onClick={onSave} disabled={busy || !status?.ok} className="j4u-press flex-1 h-10 rounded-[10px] text-[12.5px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--primary-600)', border: 'none' }}>Save</button>
        </div>
      </div>

      <div style={card}>
        <div className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg><div className="text-[14px] font-bold" style={{ color: 'var(--text-strong)' }}>Privacy</div></div>
        <div className="text-[12px] leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>Your CV, answers and keys are tied to your account. The app never auto-submits applications.</div>
        <button onClick={reRunSetup} className="j4u-press mt-3 h-9 px-3.5 rounded-[9px] text-[12.5px] font-semibold" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)' }}>Re-run setup wizard</button>
      </div>

      <div style={card}>
        <div className="text-[14px] font-bold mb-2.5" style={{ color: 'var(--text-strong)' }}>Help &amp; feedback</div>
        <div className="flex flex-col gap-2.5">
          <a href="https://github.com/tabrezgoilkar/jobs4uae-autopilot/issues/new?labels=enhancement&title=Feature%20request:%20" target="_blank" rel="noreferrer" className="j4u-press flex items-center gap-3" style={{ border: '1px solid var(--border-subtle)', borderRadius: 11, padding: 12, textDecoration: 'none' }}><span className="flex-none flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--ai-soft)' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B45F0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg></span><span className="flex-1"><span className="block text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Request a feature</span><span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Opens a GitHub issue</span></span></a>
          <a href="https://github.com/tabrezgoilkar/jobs4uae-autopilot/issues/new?labels=bug&title=Issue:%20" target="_blank" rel="noreferrer" className="j4u-press flex items-center gap-3" style={{ border: '1px solid var(--border-subtle)', borderRadius: 11, padding: 12, textDecoration: 'none' }}><span className="flex-none flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--danger-soft)' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="6" width="8" height="12" rx="4" /><path d="M19 7l-2 2M5 7l2 2M3 13h3M18 13h3M19 18l-2-2M5 18l2-2M12 6V3" /></svg></span><span className="flex-1"><span className="block text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Report an issue</span><span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>Opens a GitHub issue</span></span></a>
        </div>
      </div>
    </div>
  );
}
