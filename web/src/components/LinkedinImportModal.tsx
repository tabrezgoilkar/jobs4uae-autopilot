import { useEffect, useRef, useState } from 'react';
import {
  getLinkedinBookmarklet,
  importLinkedinFile,
  importLinkedinJson,
  getPendingLinkedin,
  type LinkedinImportResult,
  type Profile,
} from '../api';

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name', email: 'Email', phone: 'Phone',
  location: 'Location', headline: 'Headline', summary: 'Summary',
};
const SECTION_LABELS: Record<string, string> = {
  experience: 'experience', education: 'education', certifications: 'certifications',
  languages: 'languages', awards: 'awards', projects: 'projects', skills: 'skills', links: 'links',
};

function LinkedInMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.8-2.05 4.06 0 4.8 2.67 4.8 6.14V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" />
    </svg>
  );
}

export default function LinkedinImportModal({
  onApply,
  onClose,
}: {
  onApply: (merged: Profile) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<LinkedinImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const bmRef = useRef<HTMLAnchorElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the bookmarklet href; set it via setAttribute so React doesn't sanitize the javascript: URL.
  useEffect(() => {
    getLinkedinBookmarklet()
      .then(({ href }) => { if (bmRef.current) bmRef.current.setAttribute('href', href); })
      .catch(() => {});
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // While waiting on the input screen, poll for an import the user triggered in their LinkedIn tab.
  useEffect(() => {
    if (result) return;
    const id = setInterval(() => {
      getPendingLinkedin().then((p) => { if (p) setResult(p); }).catch(() => {});
    }, 2500);
    return () => clearInterval(id);
  }, [result]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      setResult(await importLinkedinFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onPaste() {
    setBusy(true); setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasteText);
    } catch {
      setBusy(false);
      setError('That is not valid JSON. Paste the contents of linkedin-profile.json.');
      return;
    }
    try {
      setResult(await importLinkedinJson(parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const changes = result?.changes;
  const addedKeys = changes ? Object.keys(changes.added) : [];
  const nothingToAdd = !!changes && changes.filled.length === 0 && addedKeys.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import from LinkedIn"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-hair rounded-md shadow-lg w-full max-w-[560px] mx-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hair text-[#0a66c2]">
          <LinkedInMark />
          <span className="text-[15px] font-bold text-ink-strong">Import from LinkedIn</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-ink-muted hover:text-ink j4u-focus rounded px-1">✕</button>
        </div>

        {!result && (
          <div className="p-5 space-y-4">
            <p className="text-[13px] text-ink-secondary leading-snug">
              Pulls your profile in your own browser — it goes only to this local app, never to a cloud.
            </p>

            <ol className="space-y-3 text-[13.5px] text-ink-secondary">
              <li className="flex items-start gap-2.5">
                <Step n={1} />
                <span className="pt-0.5">
                  Drag this button to your bookmarks bar:&nbsp;
                  <a
                    ref={bmRef}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    draggable
                    className="inline-flex items-center gap-1.5 align-middle h-8 px-3 rounded-md bg-[#0a66c2] text-white text-xs font-semibold cursor-grab active:cursor-grabbing select-none"
                  >
                    <LinkedInMark /> Send to Jobs4UAE
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Step n={2} />
                <span className="pt-0.5">Open <strong className="text-ink">your own</strong> LinkedIn profile while logged in.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Step n={3} />
                <span className="pt-0.5">Click the <strong className="text-ink">Send to Jobs4UAE</strong> bookmark — your profile appears here to review.</span>
              </li>
            </ol>

            <div className="flex items-center gap-2 text-[12px] text-ai-700">
              <span className="inline-block w-2 h-2 rounded-full bg-ai-500 animate-pulse" />
              Waiting for your LinkedIn import…
              <a href="/linkedin" target="_blank" rel="noreferrer" className="ml-auto text-primary-700 font-semibold j4u-focus rounded">Full instructions ↗</a>
            </div>

            <div className="pt-3 border-t border-hair-subtle">
              <div className="text-[12px] text-ink-muted mb-2">Or import a saved file (linkedin-profile.json or a JSON Resume):</div>
              <div className="flex items-center gap-3 flex-wrap">
                <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} disabled={busy} className="text-sm text-ink-secondary" />
                <button onClick={() => setShowPaste((s) => !s)} className="text-[12px] font-semibold text-primary-700 j4u-focus rounded">
                  {showPaste ? 'Hide paste box' : 'Paste JSON instead'}
                </button>
              </div>
              {showPaste && (
                <div className="mt-2.5 space-y-2">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={4}
                    placeholder='Paste the JSON here…'
                    className="w-full rounded-md border border-hair bg-surface text-ink p-2 text-xs font-mono j4u-focus"
                  />
                  <button onClick={onPaste} disabled={busy || !pasteText.trim()} className="j4u-press text-[12.5px] font-semibold text-white bg-primary-700 rounded-md px-3 py-1.5 disabled:opacity-50">
                    Import pasted JSON
                  </button>
                </div>
              )}
            </div>

            {busy && <p className="text-sm text-primary-700">Reading your profile…</p>}
            {error && <p role="alert" className="text-sm rounded-md p-2.5 bg-danger-soft text-danger-text border border-danger-soft">{error}</p>}
          </div>
        )}

        {result && (
          <div className="p-5 space-y-4">
            {nothingToAdd ? (
              <p className="text-[13.5px] text-ink-secondary">
                Your profile already has everything from your LinkedIn — nothing new to add. You can still apply to refresh blank fields.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] text-ink-strong font-semibold">Here's what we'll merge in:</p>
                <div className="space-y-2.5">
                  {changes!.filled.length > 0 && (
                    <SummaryRow label="Filled blank fields" items={changes!.filled.map((f) => FIELD_LABELS[f] ?? f)} />
                  )}
                  {addedKeys.map((k) => (
                    <SummaryRow
                      key={k}
                      label={`Added ${changes!.added[k]} ${SECTION_LABELS[k] ?? k}`}
                      items={changes!.addedItems[k] ?? []}
                    />
                  ))}
                </div>
              </>
            )}
            <p className="text-[12px] text-ink-muted">Nothing you already typed is overwritten. Review the full profile after applying, then Save.</p>
            <div className="flex items-center gap-2.5 pt-1">
              <button onClick={() => onApply(result.merged)} className="j4u-press text-[13px] font-semibold text-white bg-primary-700 rounded-md px-4 py-2">
                Apply to my profile
              </button>
              <button onClick={() => { setResult(null); setError(null); }} className="j4u-chip text-[13px] font-semibold text-ink-secondary border border-hair rounded-md px-4 py-2">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-ai-soft text-ai-700 text-[11px] font-bold">{n}</span>
  );
}

function SummaryRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="border border-hair-subtle rounded-md px-3 py-2">
      <div className="text-[12.5px] font-semibold text-ink-strong">{label}</div>
      {items.length > 0 && (
        <div className="text-[12px] text-ink-secondary mt-0.5 leading-snug">{items.slice(0, 8).join(', ')}{items.length > 8 ? `, +${items.length - 8} more` : ''}</div>
      )}
    </div>
  );
}
