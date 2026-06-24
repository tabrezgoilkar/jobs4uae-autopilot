import { useEffect, useRef, useState } from 'react';
import { askCopilot, type CopilotTurn } from '../features/copilot/copilotApi';
import { IconSparkle } from './icons';

const SUGGESTIONS = [
  'Draft a cover letter',
  'Prep me for the interview',
  'How do I stand out in the UAE market?',
];

export default function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [turns, busy]);

  if (!open) return null;

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.slice();
    setTurns((t) => [...t, { role: 'user', content: question }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const answer = await askCopilot(question, history);
      setTurns((t) => [...t, { role: 'assistant', content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the copilot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'var(--scrim)' }} onClick={onClose}>
    <aside
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col h-full w-full max-w-[400px]"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-hair-subtle">
        <IconSparkle size={17} color="var(--ai-600)" />
        <span className="text-sm font-semibold text-ink-strong">Career copilot</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-ai-700 bg-ai-soft border border-ai-soft px-2 py-0.5 rounded-pill">UAE market</span>
        <button onClick={onClose} aria-label="Close copilot" className="text-ink-muted p-0.5 j4u-focus rounded">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {turns.length === 0 && !busy && (
          <div className="text-[13px] text-ink-secondary leading-relaxed">
            <p className="m-0">Hi! I'm your career copilot. Ask me about the UAE job market, visas, labour law, your CV, or interview prep.</p>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="self-end max-w-[85%] bg-primary-600 text-white text-[13px] leading-relaxed px-3 py-2" style={{ borderRadius: '12px 12px 4px 12px' }}>
              {t.content}
            </div>
          ) : (
            <div key={i} className="max-w-[92%] bg-ai-soft border border-ai-soft text-ink text-[13px] leading-relaxed px-3 py-2.5 whitespace-pre-wrap" style={{ borderRadius: '12px 12px 12px 4px' }}>
              {t.content}
            </div>
          ),
        )}
        {busy && (
          <div className="max-w-[92%] bg-ai-soft border border-ai-soft px-3 py-2.5 flex items-center gap-2 text-[13px] text-ink-muted" style={{ borderRadius: '12px 12px 12px 4px' }}>
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-ai-600 border-t-transparent animate-spin" />
            Thinking…
          </div>
        )}
        {error && <div role="alert" className="text-[12.5px] text-danger-text">{error}</div>}
      </div>

      <div className="border-t border-hair-subtle p-3">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="j4u-chip text-xs font-medium text-ink-secondary border border-hair rounded-pill px-2.5 py-1">{s}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 h-11 px-3 border border-hair rounded-[11px]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your copilot anything…"
            aria-label="Message the copilot"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted outline-none"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-[30px] h-[30px] flex-none rounded-sm bg-ai-600 flex items-center justify-center disabled:opacity-50 j4u-press">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        </form>
      </div>
    </aside>
    </div>
  );
}
