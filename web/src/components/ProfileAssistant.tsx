import { useEffect, useRef, useState } from 'react';
import { assistProfile, saveProfile, type Profile } from '../api';
import { IconSparkle } from './icons';
import ProfileDiff from './ProfileDiff';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  questions?: string[];
  proposed?: Profile | null;
  applied?: boolean;
  error?: boolean;
}

const QUICK = [
  'Improve my whole CV — fix grammar and make it professional',
  'Make my summary sharper and keyword-rich',
  'Rewrite my experience bullets to lead with impact',
];

export default function ProfileAssistant({ current, onApplied, onClose }: { current: Profile; onApplied: (p: Profile) => void; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await assistProfile(message);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply || (res.proposed ? 'Here are the proposed changes.' : 'Let me know a bit more.'), questions: res.questions, proposed: res.proposed }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e instanceof Error ? e.message : 'Something went wrong.', error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function apply(idx: number, proposed: Profile) {
    setApplyingIdx(idx);
    try {
      const saved = await saveProfile(proposed);
      onApplied(saved);
      setMsgs((m) => m.map((msg, i) => (i === idx ? { ...msg, applied: true } : msg)));
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Could not save the changes. Please try again.', error: true }]);
    } finally {
      setApplyingIdx(null);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Profile assistant" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--scrim)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border-l border-hair shadow-lg h-full w-full max-w-[420px] flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-3.5 j4u-grad-ai border-b border-ai-soft">
          <IconSparkle size={16} color="var(--ai-600)" />
          <span className="text-[14px] font-bold text-ink-strong">Profile assistant</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-ink-muted hover:text-ink j4u-focus rounded px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-secondary leading-relaxed">
                Tell me what to add or improve in plain words — e.g. <em>"I led a billing revamp project at Acme that cut churn 20%"</em>, or
                <em> "fix the grammar and make my CV professional"</em>. I'll propose the change and you confirm. I never invent facts — I'll ask if something's missing.
              </p>
              <div className="flex flex-col gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="j4u-chip text-left text-[12.5px] text-ink-secondary border border-ai-soft bg-ai-soft rounded-md px-3 py-2">{q}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`rounded-md px-3 py-2 text-[13px] leading-relaxed max-w-[92%] ${
                m.role === 'user' ? 'bg-primary-600 text-white' : m.error ? 'bg-danger-soft text-danger-text border border-danger-soft' : 'bg-surface-sunken text-ink-secondary border border-hair'
              }`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.questions && m.questions.length > 0 && (
                  <ul className="list-disc pl-4 mt-1.5 space-y-0.5 text-ink-strong">{m.questions.map((q, j) => <li key={j}>{q}</li>)}</ul>
                )}
                {m.proposed && (
                  <>
                    <ProfileDiff current={current} proposed={m.proposed as Profile} />
                    {m.applied ? (
                      <div className="mt-2 text-[12px] font-semibold text-success-text">✓ Applied to your profile</div>
                    ) : (
                      <button onClick={() => apply(i, m.proposed as Profile)} disabled={applyingIdx === i}
                        className="j4u-press mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-ai-600 text-white text-[12px] font-semibold disabled:opacity-60">
                        {applyingIdx === i ? 'Applying…' : '✓ Apply these changes'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-[12.5px] text-ai-700">Thinking…</div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-hair p-3 flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tell me what to add or improve…"
            className="flex-1 rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted" />
          <button type="submit" disabled={busy || !input.trim()} className="j4u-press h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold disabled:opacity-60">Send</button>
        </form>
      </div>
    </div>
  );
}
