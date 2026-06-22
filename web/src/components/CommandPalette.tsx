import { useEffect, useRef, useState } from 'react';
import { askCopilot } from '../features/copilot/copilotApi';
import { IconSparkle } from './icons';

const POPULAR = [
  'Can my employer stop me switching jobs, or ban me?',
  'How is end-of-service gratuity calculated?',
  'Free zone vs mainland visa — what changes for me?',
  'What notice period is standard, and can I be held to it?',
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(''); setAsked(null); setAnswer(''); setError(null); setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setAsked(question); setBusy(true); setError(null); setAnswer('');
    try {
      setAnswer(await askCopilot(question));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the copilot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 90 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="j4u-rise"
        style={{ width: 620, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        {/* input row */}
        <form
          onSubmit={(e) => { e.preventDefault(); submit(query); }}
          className="flex items-center gap-2.5 px-[18px] py-[15px] border-b border-hair-subtle"
        >
          <IconSparkle size={17} color="var(--ai-600)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about the UAE job market, visas & labour law…"
            aria-label="Ask the copilot"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none"
          />
          <span className="font-mono text-[10px] text-ink-muted border border-hair rounded px-1.5 py-0.5">esc</span>
        </form>

        {/* idle: popular questions */}
        {!asked && (
          <div className="px-[18px] py-[14px] pb-[18px]">
            <div className="text-[10px] font-bold tracking-wide uppercase text-ink-muted mb-2.5">Popular questions</div>
            <div className="flex flex-col gap-1.5">
              {POPULAR.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="j4u-press flex items-center gap-2.5 px-3 py-2.5 border border-hair-subtle rounded-[10px] text-left"
                >
                  <span className="flex-1 text-[13px] text-ink">{q}</span>
                  <span className="text-ink-muted">→</span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-ink-muted flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
              General guidance on UAE labour law &amp; the job market — not legal advice.
            </div>
          </div>
        )}

        {/* answered */}
        {asked && (
          <div className="px-[18px] py-4 pb-[18px] j4u-rise">
            <div className="inline-block bg-primary-600 text-white text-[13px] font-medium px-3 py-2" style={{ borderRadius: '10px 10px 10px 4px' }}>
              {asked}
            </div>
            <div className="mt-3 bg-ai-soft border border-ai-soft px-[15px] py-3.5" style={{ borderRadius: '10px 10px 4px 10px' }}>
              {busy && (
                <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-ai-600 border-t-transparent animate-spin" />
                  Thinking…
                </div>
              )}
              {error && <p className="m-0 text-[13px] text-danger-text">{error}</p>}
              {!busy && !error && <p className="m-0 text-[13px] leading-relaxed text-ink whitespace-pre-wrap">{answer}</p>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => { setAsked(null); setQuery(''); setTimeout(() => inputRef.current?.focus(), 20); }} className="j4u-press text-[11.5px] font-semibold text-ink-secondary border border-hair rounded-pill px-3 py-1.5">Ask another</button>
              <span className="ml-auto text-[10.5px] text-ink-muted flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                General guidance, not legal advice. Verify with MOHRE.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
