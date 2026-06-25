import { useEffect, useRef, useState } from 'react';
import { askCopilot, type CopilotTurn } from '../features/copilot/copilotApi';

function Sheet({ height, onClose, children }: { height: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} className="j4u-rise flex flex-col overflow-hidden" style={{ width: '100%', height, maxHeight: '92%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--shadow-overlay)' }}>
        {children}
      </div>
    </div>
  );
}
function CloseX({ onClose }: { onClose: () => void }) {
  return <button onClick={onClose} aria-label="Close" className="ml-auto" style={{ color: 'var(--text-muted)', display: 'flex', padding: 2 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>;
}
function Sparkle() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="#6B45F0"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>; }

const COPILOT_CHIPS = ['How do I improve my profile?', 'Draft a cover letter', 'How do I stand out in the UAE market?'];

export function MobileCopilotSheet({ onClose }: { onClose: () => void }) {
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = turns.slice();
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setInput(''); setBusy(true);
    try { const ans = await askCopilot(q, history); setTurns((t) => [...t, { role: 'assistant', content: ans }]); }
    catch (e) { setTurns((t) => [...t, { role: 'assistant', content: e instanceof Error ? e.message : 'Could not reach the copilot.' }]); }
    finally { setBusy(false); }
  }

  return (
    <Sheet height="88%" onClose={onClose}>
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Sparkle /><span className="text-[14px] font-semibold" style={{ color: 'var(--text-strong)' }}>Career copilot</span><CloseX onClose={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {turns.length === 0 && <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Ask anything about your job search, your CV, or the UAE market — grounded in your profile.</p>}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'self-end max-w-[85%]' : 'max-w-[92%]'} style={t.role === 'user'
            ? { background: 'var(--primary-600)', color: '#fff', borderRadius: '13px 13px 4px 13px', padding: '9px 13px', fontSize: 13, lineHeight: 1.5 }
            : { background: 'var(--ai-soft)', border: '1px solid #E0D5FB', borderRadius: '13px 13px 13px 4px', padding: '11px 13px', fontSize: 13, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{t.content}</div>
        ))}
        {busy && <div className="text-[12.5px]" style={{ color: 'var(--ai-700)' }}>Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="px-4 pb-5">
        {turns.length === 0 && (
          <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-0.5">
            {COPILOT_CHIPS.map((c) => <button key={c} onClick={() => send(c)} className="j4u-press flex-none text-[12px] font-medium" style={{ color: 'var(--ai-700)', background: 'var(--ai-soft)', border: '1px solid #E0D5FB', borderRadius: 9999, padding: '6px 12px', whiteSpace: 'nowrap' }}>{c}</button>)}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 px-3" style={{ height: 46, border: '1px solid var(--border)', borderRadius: 12 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your copilot anything…" className="flex-1 text-[13px] bg-transparent outline-none" style={{ color: 'var(--text)' }} />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex items-center justify-center disabled:opacity-50" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ai-600)', border: 'none' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg></button>
        </form>
      </div>
    </Sheet>
  );
}

const POPULAR = [
  'Can my employer stop me switching jobs?',
  'How is end-of-service gratuity calculated?',
  'Free zone vs mainland visa — what changes?',
];

export function MobileAskSheet({ onClose }: { onClose: () => void }) {
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setAsked(question); setBusy(true); setAnswer('');
    try { setAnswer(await askCopilot(question, [])); }
    catch (e) { setAnswer(e instanceof Error ? e.message : 'Could not reach the assistant.'); }
    finally { setBusy(false); }
  }

  return (
    <Sheet height="auto" onClose={onClose}>
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Sparkle /><span className="flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Ask about UAE jobs, visas &amp; labour law</span><CloseX onClose={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {!asked ? (
          <div className="px-4 py-4 pb-5">
            <div className="text-[10px] font-bold uppercase mb-2.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Popular questions</div>
            <div className="flex flex-col gap-1.5">
              {POPULAR.map((q) => (
                <button key={q} onClick={() => ask(q)} className="j4u-press text-left flex items-center gap-2.5 px-3 py-3" style={{ border: '1px solid var(--border-subtle)', borderRadius: 11 }}>
                  <span className="flex-1 text-[12.5px]" style={{ color: 'var(--text)' }}>{q}</span><span style={{ color: 'var(--text-muted)' }}>→</span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>General guidance on UAE labour law — not legal advice.</div>
          </div>
        ) : (
          <div className="j4u-rise p-4">
            <div className="inline-block text-[12.5px] font-medium" style={{ background: 'var(--primary-600)', color: '#fff', borderRadius: '11px 11px 11px 4px', padding: '8px 13px' }}>{asked}</div>
            <div className="mt-3" style={{ background: 'var(--ai-soft)', border: '1px solid #E0D5FB', borderRadius: '11px 11px 4px 11px', padding: 13 }}>
              <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{busy ? 'Thinking…' : answer}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => { setAsked(''); setAnswer(''); }} className="j4u-press text-[11.5px] font-semibold" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 9999, padding: '6px 12px' }}>Ask another</button>
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Not legal advice. Verify with MOHRE.</span>
            </div>
          </div>
        )}
      </div>
      {!asked && (
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="px-4 pb-5 pt-1 flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" className="flex-1 text-[13px] px-3" style={{ height: 44, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }} />
          <button type="submit" disabled={busy || !input.trim()} className="text-white text-[12.5px] font-semibold disabled:opacity-50" style={{ height: 44, padding: '0 16px', borderRadius: 12, background: 'var(--ai-600)', border: 'none' }}>Ask</button>
        </form>
      )}
    </Sheet>
  );
}
