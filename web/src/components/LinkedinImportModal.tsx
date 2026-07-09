import { useEffect, useState } from 'react';
import {
  importLinkedinFile,
  importLinkedinUrl,
  importLinkedinScreenshots,
  buildBaseline,
  isLikelyProfileUrl,
  LinkedinImportError,
  type LinkedinImportResult,
  type Profile,
} from '../api';

// On the cloud build (Clerk key present) the paste-URL fetch is blocked by
// LinkedIn's IP wall, so screenshots is the reliable default there.
const IS_CLOUD = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name', email: 'Email', phone: 'Phone',
  location: 'Location', headline: 'Headline', summary: 'Summary',
};
const SECTION_LABELS: Record<string, string> = {
  experience: 'experience', education: 'education', certifications: 'certifications',
  languages: 'languages', awards: 'awards', projects: 'projects', skills: 'skills', links: 'links',
};

type Tab = 'url' | 'screenshots' | 'file';

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
  const [tab, setTab] = useState<Tab>(IS_CLOUD ? 'screenshots' : 'url');
  const [result, setResult] = useState<LinkedinImportResult | null>(null);
  const [busy, setBusy] = useState<false | 'import' | 'baseline'>(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  // When a URL import is blocked, remember whether the server said the bookmarklet
  // / screenshot fallbacks are worth offering (it tells us per-request).
  const [offer, setOffer] = useState<{ bookmarklet?: boolean; screenshots?: boolean }>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(fn: () => Promise<LinkedinImportResult>) {
    setBusy('import'); setError(null); setOffer({});
    try {
      setResult(await fn());
    } catch (err) {
      if (err instanceof LinkedinImportError && err.reason === 'blocked') {
        // The server already tried the local-browser tier (on the desktop app) and
        // still failed, so it tells us which fallbacks are worth offering. Show them
        // instead of a dead-end message.
        const wantBookmarklet = err.offerBookmarklet ?? true;
        const wantScreenshots = err.offerScreenshots ?? true;
        setOffer({ bookmarklet: wantBookmarklet, screenshots: wantScreenshots });
        setError('LinkedIn blocked the direct read. Pick a fallback below — both run from your own browser.');
        setTab(wantScreenshots ? 'screenshots' : 'file');
      } else {
        setError(err instanceof Error ? err.message : 'Import failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  // Apply = fill a baseline summary, then hand the profile back for review + Save.
  async function apply() {
    if (!result) return;
    setBusy('baseline');
    try {
      const { profile } = await buildBaseline(result.merged);
      onApply(profile);
    } catch {
      onApply(result.merged); // best-effort — apply without the baseline step
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
            <div role="tablist" aria-label="Import method" className="flex gap-1 p-1 rounded-md bg-ai-soft/40 border border-hair-subtle">
              <TabButton active={tab === 'url'} onClick={() => { setTab('url'); setError(null); }}>Paste URL</TabButton>
              <TabButton active={tab === 'screenshots'} onClick={() => { setTab('screenshots'); setError(null); }}>
                Screenshots{offer.screenshots && <span className="ml-1 text-[10px] text-primary-700 font-semibold">recommended</span>}
              </TabButton>
              <TabButton active={tab === 'file'} onClick={() => { setTab('file'); setError(null); }}>Upload file</TabButton>
            </div>

            {tab === 'url' && (
              <div className="space-y-2.5">
                <p className="text-[13px] text-ink-secondary leading-snug">
                  Paste your public LinkedIn profile URL — we import the basics instantly.
                  {IS_CLOUD && ' On the hosted app this is often blocked; Screenshots is more reliable.'}
                </p>
                <input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-name"
                  className="w-full h-10 rounded-md border border-hair bg-surface text-ink px-3 text-sm j4u-focus"
                />
                <button
                  onClick={() => run(() => importLinkedinUrl(url.trim()))}
                  disabled={busy !== false || !isLikelyProfileUrl(url)}
                  className="j4u-press text-[13px] font-semibold text-white bg-primary-700 rounded-md px-4 py-2 disabled:opacity-50"
                >
                  Import from URL
                </button>
                <p className="text-[12px] text-ink-muted leading-snug">
                  Tip: for the <strong className="text-ink">fullest</strong> import (skills + every role), use the
                  {' '}<a href="/linkedin" target="_blank" rel="noreferrer" className="text-primary-700 underline">1-click bookmarklet</a>{' '}
                  — it reads your own logged-in profile. The URL read only gets the public basics.
                </p>
              </div>
            )}

            {tab === 'screenshots' && (
              <div className="space-y-2.5">
                <p className="text-[13px] text-ink-secondary leading-snug">
                  Open your profile, click <strong className="text-ink">Show all</strong> on Experience &amp; Skills, then take a few
                  screenshots covering the whole page. Drop them in — a vision model reads them (nothing is uploaded to LinkedIn).
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="text-sm text-ink-secondary"
                />
                {files.length > 0 && <p className="text-[12px] text-ink-muted">{files.length} image{files.length > 1 ? 's' : ''} selected</p>}
                <button
                  onClick={() => run(() => importLinkedinScreenshots(files))}
                  disabled={busy !== false || files.length === 0}
                  className="j4u-press text-[13px] font-semibold text-white bg-primary-700 rounded-md px-4 py-2 disabled:opacity-50"
                >
                  Read my screenshots
                </button>
              </div>
            )}

            {tab === 'file' && (
              <div className="space-y-2.5">
                <p className="text-[13px] text-ink-secondary leading-snug">
                  Have a CV or a LinkedIn/JSON&nbsp;Resume export? Upload it and we'll structure it into your profile.
                </p>
                <input
                  type="file"
                  accept=".json,application/json,.pdf,.doc,.docx,.txt"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => importLinkedinFile(f)); }}
                  className="text-sm text-ink-secondary"
                />
              </div>
            )}

            {busy === 'import' && <p className="text-sm text-primary-700">Reading your profile…</p>}
            {error && <p role="alert" className="text-sm rounded-md p-2.5 bg-danger-soft text-danger-text border border-danger-soft">{error}</p>}
          </div>
        )}

        {result && (
          <div className="p-5 space-y-4">
            {nothingToAdd ? (
              <p className="text-[13.5px] text-ink-secondary">
                Your profile already has everything from this import — nothing new to add.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] text-ink-strong font-semibold">Here's what we'll merge in:</p>
                <div className="space-y-2.5">
                  {changes!.filled.length > 0 && (
                    <SummaryRow label="Filled blank fields" items={changes!.filled.map((f) => FIELD_LABELS[f] ?? f)} />
                  )}
                  {addedKeys.map((k) => (
                    <SummaryRow key={k} label={`Added ${changes!.added[k]} ${SECTION_LABELS[k] ?? k}`} items={changes!.addedItems[k] ?? []} />
                  ))}
                </div>
              </>
            )}
            {result.partial && (
              <p className="text-[12px] text-ai-700">
                Imported the basics{result.via === 'local' ? ' from your browser' : ''}. Add a Screenshots or bookmarklet import to capture skills &amp; full roles.
              </p>
            )}
            <p className="text-[12px] text-ink-muted">Nothing you already typed is overwritten. We'll draft a baseline summary you can edit, then you Save.</p>
            <div className="flex items-center gap-2.5 pt-1">
              <button onClick={apply} disabled={busy !== false} className="j4u-press text-[13px] font-semibold text-white bg-primary-700 rounded-md px-4 py-2 disabled:opacity-50">
                {busy === 'baseline' ? 'Building your baseline…' : 'Apply & build baseline'}
              </button>
              <button onClick={() => { setResult(null); setError(null); }} disabled={busy !== false} className="j4u-chip text-[13px] font-semibold text-ink-secondary border border-hair rounded-md px-4 py-2 disabled:opacity-50">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 h-8 rounded text-[12.5px] font-semibold j4u-focus ${active ? 'bg-surface text-ink-strong border border-hair shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
    >
      {children}
    </button>
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
