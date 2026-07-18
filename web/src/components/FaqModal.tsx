import { useState } from 'react';
import type { Profile, FaqItem } from '../api';

// Minimal "Generate FAQ" modal: calls the grounded generator, shows editable
// Q&A, lets the user save back to the profile. AI only phrases answers; the
// facts come from the profile, so nothing is fabricated.
export default function FaqModal({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (faq: FaqItem[]) => void }) {
  const [items, setItems] = useState<FaqItem[]>(profile.faq || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onGenerate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/profile/faq', { method: 'POST', headers: { 'content-type': 'application/json' } });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.faq)) setItems(data.faq);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  function edit(i: number, field: 'question' | 'answer', value: string) {
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Generate FAQ" className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'var(--surface-sunken)' }}>
      <div className="cv-toolbar flex-none flex items-center gap-2 px-3 sm:px-5 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}>
        <button onClick={onClose} aria-label="Close" className="j4u-chip w-9 h-9 flex items-center justify-center rounded-md border border-hair text-ink-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h2 className="text-[15px] font-bold text-ink-strong">FAQ bank</h2>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onGenerate} disabled={busy} className="j4u-press inline-flex items-center gap-2 text-white text-[12.5px] font-semibold rounded-md px-4 h-9" style={{ background: 'var(--ai-600)', border: 'none' }}>
            {busy ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={() => onSave(items)} className="j4u-press inline-flex items-center gap-2 text-ink-secondary text-[12.5px] font-semibold rounded-md px-3 h-9" style={{ border: '1px solid var(--border)' }}>
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
        {err && <div className="rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-[12.5px] text-danger-text">{err}</div>}
        {items.length === 0 && <p className="text-[12.5px] text-ink-muted">Click Generate to build a grounded Q&A bank from your profile. Answers only reuse your real data — nothing is invented.</p>}
        {items.map((it, i) => (
          <div key={i} className="rounded-md border border-hair-subtle bg-surface p-3 space-y-2">
            <label className="block">
              <span className={FIELD_LABEL}>Question</span>
              <input className={FIELD} value={it.question} onChange={(e) => edit(i, 'question', e.target.value)} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Answer</span>
              <textarea className={FIELD} rows={2} value={it.answer} onChange={(e) => edit(i, 'answer', e.target.value)} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

const FIELD = 'rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus w-full';
const FIELD_LABEL = 'block text-[11.5px] font-semibold text-ink-secondary mb-1';
