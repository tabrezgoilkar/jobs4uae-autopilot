import { useEffect, useState } from 'react';
import {
  scan,
  fetchJobFromUrl,
  evaluateJobText,
  evaluateListing,
  optimizeResume,
  researchCompany,
  saveScannedJobs,
  listScannedJobs,
  type Listing,
  type ResumeOptimization,
  type CompanyBrief,
  type EvaluationResult,
} from '../features/scanner/scannerApi';

const GCC_COUNTRIES = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];

// Friendly label for the source tag on each scanned/pasted job.
const SOURCE_LABEL: Record<string, { label: string; bg: string; bd: string; fg: string }> = {
  linkedin: { label: 'LinkedIn', bg: '#E8F0FB', bd: '#CFE1F7', fg: '#0A66C2' },
  freehire: { label: 'FreeHire', bg: '#ECFDF3', bd: '#BBF0C8', fg: '#06683B' },
  indeed: { label: 'Indeed', bg: '#EFF4FF', bd: '#C5D6FB', fg: '#2747E8' },
};
function sourceTag(source?: string) {
  if (!source) return { label: 'Link', bg: 'var(--surface-sunken)', bd: 'var(--border-subtle)', fg: 'var(--text-muted)' };
  const known = SOURCE_LABEL[source];
  if (known) return known;
  const host = source.length > 20 ? source.slice(0, 18) + '…' : source;
  return { label: host, bg: 'var(--surface-sunken)', bd: 'var(--border-subtle)', fg: 'var(--text-secondary)' };
}

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 16 } as const;

export default function MobileScan() {
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('UAE');
  const [listings, setListings] = useState<Listing[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Listing | null>(null);

  // Load the user's previously scanned jobs (so a desktop scan shows on mobile).
  useEffect(() => {
    listScannedJobs().then((saved) => { if (saved.length) setListings(saved); }).catch(() => {});
  }, []);

  async function persist(list: Listing[]) {
    try { await saveScannedJobs(list); } catch { /* non-fatal */ }
  }

  // paste-a-link
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || scanning) return;
    setScanning(true); setError(null); setListings([]); setSelected(null);
    try {
      const result = await scan({ keyword: keyword.trim(), country });
      setListings(result.listings);
      if (result.listings.length) persist(result.listings);
      if (result.error && result.listings.length === 0) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    const url = pasteUrl.trim();
    if (!url || pasteBusy) return;
    setPasteBusy(true); setPasteMsg(null);
    try {
      const { jobText, source } = await fetchJobFromUrl(url);
      const listing: Listing = { title: 'Pasted job', company: '', location: '', url, source: source || 'link' };
      // Evaluate immediately so the sheet shows fit + suggestions.
      try {
        const ev = await evaluateJobText(jobText);
        (listing as Listing & { _eval?: unknown })._eval = ev;
      } catch { /* evaluation optional */ }
      setSelected(listing);
      setListings((prev) => [listing, ...prev]);
      persist([listing, ...listings]);
      setPasteUrl('');
    } catch (err) {
      setPasteMsg(err instanceof Error ? err.message : 'Could not open that link.');
    } finally {
      setPasteBusy(false);
    }
  }

  return (
    <div className="j4u-rise space-y-4">
      {/* Search */}
      <form onSubmit={handleScan} className="space-y-2.5" style={cardStyle}>
        <div className="p-4 space-y-2.5">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Role or keyword — e.g. Accountant"
            className="w-full text-[14px] px-3.5 outline-none"
            style={{ height: 46, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }}
          />
          <div className="flex gap-2.5">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="flex-1 text-[14px] px-3 outline-none"
              style={{ height: 46, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }}
            >
              {GCC_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="submit"
              disabled={!keyword.trim() || scanning}
              className="j4u-press text-white text-[13.5px] font-semibold disabled:opacity-60"
              style={{ height: 46, padding: '0 18px', borderRadius: 12, background: 'var(--ai-600)', border: 'none' }}
            >
              {scanning ? 'Scanning…' : 'Scan jobs'}
            </button>
          </div>
        </div>
      </form>

      {/* Paste a job link — cloud-safe (server fetches + extracts text) */}
      <form onSubmit={handlePaste} className="flex items-center gap-2 px-3" style={{ ...cardStyle, height: 52, borderRadius: 13 }}>
        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>🔗</span>
        <input
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          placeholder="Paste any job link…"
          className="flex-1 min-w-0 text-[13px] bg-transparent outline-none"
          style={{ color: 'var(--text)' }}
        />
        <button
          type="submit"
          disabled={!pasteUrl.trim() || pasteBusy}
          className="j4u-press text-white text-[12.5px] font-semibold disabled:opacity-60"
          style={{ height: 38, padding: '0 14px', borderRadius: 10, background: 'var(--ai-600)', border: 'none' }}
        >
          {pasteBusy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {pasteMsg && <div className="text-[12px] px-1" style={{ color: 'var(--danger-text)' }}>{pasteMsg}</div>}

      {error && <div className="text-[12.5px] px-1" style={{ color: 'var(--danger-text)' }}>{error}</div>}

      {/* Results */}
      {listings.length === 0 && !scanning && !error && (
        <div className="text-[12.5px] px-1" style={{ color: 'var(--text-muted)' }}>Scan a keyword or paste a job link to see matches here.</div>
      )}

      {listings.map((job, i) => {
        const t = sourceTag(job.source);
        return (
          <button
            key={job.url + i}
            onClick={() => setSelected(job)}
            className="j4u-tap w-full text-left block"
            style={{ ...cardStyle, padding: 14 }}
          >
            <div className="text-[14.5px] font-semibold truncate" style={{ color: 'var(--text-strong)' }}>{job.title}</div>
            <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {[job.company, job.location].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-2 inline-flex items-center rounded-full border px-2 py-px text-[10.5px] font-semibold" style={{ background: t.bg, borderColor: t.bd, color: t.fg }}>
              {t.label}
            </div>
          </button>
        );
      })}

      {selected && (
        <JobSheet listing={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function JobSheet({ listing, onClose }: { listing: Listing & { _eval?: unknown }; onClose: () => void }) {
  const [opt, setOpt] = useState<{ busy: boolean; data: ResumeOptimization | null; error: string | null }>({ busy: false, data: null, error: null });
  const [brief, setBrief] = useState<{ busy: boolean; data: CompanyBrief | null; error: string | null }>({ busy: false, data: null, error: null });
  const [ev, setEv] = useState<{ busy: boolean; data: EvaluationResult | null; error: string | null }>({ busy: false, data: null, error: null });

  async function runEvaluate() {
    setEv({ busy: true, data: null, error: null });
    try {
      const data = await evaluateListing(listing);
      setEv({ busy: false, data, error: null });
    } catch (e) {
      setEv({ busy: false, data: null, error: e instanceof Error ? e.message : 'Evaluation failed.' });
    }
  }

  async function runOptimize() {
    setOpt({ busy: true, data: null, error: null });
    try {
      const jobText = [listing.title && `Job Title: ${listing.title}`, listing.company && `Company: ${listing.company}`, listing.location && `Location: ${listing.location}`, listing.url && `URL: ${listing.url}`].filter(Boolean).join('\n');
      const data = await optimizeResume(jobText);
      setOpt({ busy: false, data, error: null });
    } catch (e) {
      setOpt({ busy: false, data: null, error: e instanceof Error ? e.message : 'Could not generate suggestions.' });
    }
  }

  async function runResearch() {
    if (!listing.company) return;
    setBrief({ busy: true, data: null, error: null });
    try {
      const data = await researchCompany(listing.company);
      setBrief({ busy: false, data, error: null });
    } catch (e) {
      setBrief({ busy: false, data: null, error: e instanceof Error ? e.message : 'Could not research company.' });
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} className="j4u-rise flex flex-col overflow-hidden" style={{ width: '100%', height: '90%', maxHeight: '92%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--shadow-overlay)' }}>
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate" style={{ color: 'var(--text-strong)' }}>{listing.title}</div>
            <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{[listing.company, listing.location].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto" style={{ color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* actions */}
          <div className="space-y-2.5">
            <button
              onClick={runOptimize}
              disabled={opt.busy}
              className="j4u-press w-full h-[44px] rounded-[12px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{ border: '1px solid #E0D5FB', background: 'var(--ai-soft)', color: 'var(--ai-700)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#6B45F0"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
              {opt.busy ? 'Analyzing your CV…' : 'Suggest CV improvements'}
            </button>
            <button
              onClick={runResearch}
              disabled={brief.busy || !listing.company}
              className="j4u-press w-full h-[44px] rounded-[12px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{ border: '1px solid #E0D5FB', background: 'var(--ai-soft)', color: 'var(--ai-700)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#6B45F0"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
              {brief.busy ? 'Researching…' : listing.company ? `Research ${listing.company}` : 'Research company'}
            </button>
            <button
              onClick={runEvaluate}
              disabled={ev.busy}
              className="j4u-press w-full h-[44px] rounded-[12px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-sunken)', color: 'var(--text-strong)' }}
            >
              {ev.busy ? 'Evaluating fit…' : 'Evaluate fit'}
            </button>
          </div>

          {ev.error && <div className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{ev.error}</div>}
          {ev.data && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--ai-soft)', border: '1px solid #E0D5FB' }}>
                  <span className="text-[20px] font-bold" style={{ color: 'var(--ai-700)' }}>{ev.data.grade}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold capitalize" style={{ color: 'var(--text-strong)' }}>{ev.data.recommendation}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Fit grade</div>
                </div>
              </div>
              {ev.data.summary && <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ev.data.summary}</p>}
              {ev.data.dimensions?.length > 0 && (
                <div className="space-y-1.5">
                  {ev.data.dimensions.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text)' }}>{d.name}</span>
                      <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>{d.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {opt.error && <div className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{opt.error}</div>}
          {brief.error && <div className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{brief.error}</div>}

          {/* CV suggestions */}
          {opt.data && (
            <div className="space-y-3">
              {opt.data.content_suggestions?.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Rewrite suggestions</div>
                  <div className="space-y-2">
                    {opt.data.content_suggestions.slice(0, 6).map((s, i) => (
                      <div key={i} className="rounded-[12px] border p-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-sunken)' }}>
                        <div className="text-[11.5px] font-semibold" style={{ color: 'var(--text-strong)' }}>{s.section}</div>
                        <div className="mt-1 text-[11.5px] line-through" style={{ color: 'var(--text-muted)' }}>{s.before}</div>
                        <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{s.after}</div>
                        <div className="mt-1 text-[11px]" style={{ color: 'var(--ai-700)' }}>{s.rationale}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {opt.data.skills_to_highlight?.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Skills to highlight</div>
                  <div className="flex flex-wrap gap-1.5">
                    {opt.data.skills_to_highlight.slice(0, 8).map((s, i) => (
                      <span key={i} className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'var(--ai-soft)', color: 'var(--ai-700)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {opt.data.keywords_for_ats?.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Keywords for ATS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {opt.data.keywords_for_ats.slice(0, 10).map((s, i) => (
                      <span key={i} className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Company research */}
          {brief.data && (
            <div className="space-y-3">
              {brief.data.snapshot && <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{brief.data.snapshot}</p>}
              {brief.data.market_position && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Market position</div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text)' }}>{brief.data.market_position}</p>
                </div>
              )}
              {brief.data.culture_signals?.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Culture signals</div>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.data.culture_signals.map((s, i) => (
                      <span key={i} className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {brief.data.interview_questions?.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Likely interview questions</div>
                  <ul className="space-y-1.5">
                    {brief.data.interview_questions.map((q, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed flex gap-2" style={{ color: 'var(--text)' }}><span style={{ color: 'var(--ai-700)' }}>•</span>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
