import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getProfile, saveProfile, importCv, type Profile } from '../api';
import { analyzeProfile } from '../lib/profileStrength';
import LinkedinImportModal from '../components/LinkedinImportModal';
import ProfileAssistant from '../components/ProfileAssistant';
import CvExportModal from '../features/cv/CvExportModal';

function md(text: string) {
  return DOMPurify.sanitize(marked.parse(text.replace(/\s*[••‣◦⁃∙]\s+/g, '\n- '), { async: false }) as string);
}
const card = { background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 } as const;
const fieldBox = { border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 } as const;

export default function MobileProfile({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importing, setImporting] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);
  const strength = useMemo(() => (profile ? analyzeProfile(profile) : null), [profile]);
  function flash(t: string) { setToast(t); window.setTimeout(() => setToast(null), 2400); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const saved = await saveProfile(await importCv(file));
      setProfile(saved); flash('CV imported & saved');
    } catch (err) { flash(err instanceof Error ? err.message : 'Import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!profile) return <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  const dash = strength ? Math.round((1 - strength.score / 100) * 157) : 157;

  return (
    <div className="j4u-rise space-y-3.5">
      {/* strength */}
      <div className="flex items-center gap-3.5" style={{ borderRadius: 16, padding: 16, background: 'linear-gradient(135deg,#F6F2FE,#EEF3FF)', border: '1px solid #E0D5FB' }}>
        <div className="relative flex-none" style={{ width: 58, height: 58 }}>
          <svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="25" fill="none" stroke="#E3DAF8" strokeWidth="6" /><circle cx="29" cy="29" r="25" fill="none" stroke="var(--ai-600)" strokeWidth="6" strokeLinecap="round" strokeDasharray="157" strokeDashoffset={dash} transform="rotate(-90 29 29)" /></svg>
          <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold" style={{ color: 'var(--text-strong)' }}>{strength?.score ?? 0}%</div>
        </div>
        <div className="flex-1"><div className="text-[14px] font-bold" style={{ color: 'var(--text-strong)' }}>Profile strength</div><div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>{(strength?.score ?? 0) >= 65 ? 'Strong — a few tweaks lift your match.' : 'Fill the gaps to match more jobs.'}</div></div>
      </div>

      {/* improve with AI + export */}
      <div className="flex gap-2.5">
        <button onClick={() => setAssistantOpen(true)} className="j4u-press flex-1 flex items-center justify-center gap-2 text-white text-[13px] font-semibold" style={{ height: 44, borderRadius: 12, background: 'var(--ai-600)', border: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>Improve with AI
        </button>
        <button onClick={() => setCvOpen(true)} className="j4u-press flex-none flex items-center justify-center gap-2 text-[13px] font-semibold" style={{ height: 44, padding: '0 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-strong)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></svg>Export CV
        </button>
      </div>

      {/* import / sync */}
      <div className="flex flex-col gap-2.5">
        <label className="j4u-press flex items-center gap-3" style={{ ...card, padding: 13, cursor: 'pointer' }}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={importing} className="hidden" />
          <span className="flex-none flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-50)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D5BD6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg></span>
          <div className="flex-1 min-w-0"><div className="text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Import from your CV</div><div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{importing ? 'Reading…' : 'PDF, Word or text'}</div></div>
        </label>
        <div className="flex items-center gap-3" style={{ borderRadius: 13, padding: 13, background: 'linear-gradient(135deg,#F6F2FE,#EEF3FF)', border: '1px solid #E0D5FB' }}>
          <span className="flex-none flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, background: '#fff' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.8-2.05 4.06 0 4.8 2.67 4.8 6.14V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" /></svg></span>
          <div className="flex-1 min-w-0"><div className="text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Import from LinkedIn</div><div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Review &amp; merge</div></div>
          <button onClick={() => setLinkedinOpen(true)} className="j4u-press flex-none text-white text-[12px] font-semibold" style={{ height: 34, padding: '0 13px', borderRadius: 9, background: 'var(--ai-600)', border: 'none' }}>Sync</button>
        </div>
      </div>

      {/* details */}
      <div className="flex items-center gap-2" style={{ margin: '6px 0 2px' }}><div className="text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Your details</div></div>
      <div style={card} className="flex flex-col gap-3">
        <Field label="Full name" value={profile.fullName} />
        <Field label="Headline" value={profile.headline} />
        <Field label="Location" value={profile.location} />
        <Field label="Contact" value={[profile.email, profile.phone].filter(Boolean).join('  ·  ')} />
        {profile.summary?.trim() && <div><div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Summary</div><div style={fieldBox} className="j4u-doc" dangerouslySetInnerHTML={{ __html: md(profile.summary) }} /></div>}
      </div>

      {/* skills */}
      {profile.skills.length > 0 && (
        <div style={card}>
          <div className="text-[13px] font-bold mb-2.5" style={{ color: 'var(--text-strong)' }}>Skills</div>
          <div className="flex flex-wrap gap-1.5">{profile.skills.map((s, i) => <span key={i} className="text-[12px] font-medium" style={{ padding: '5px 12px', borderRadius: 9999, background: 'var(--surface-sunken)', color: 'var(--text)' }}>{s}</span>)}</div>
        </div>
      )}

      {/* experience */}
      {profile.experience.length > 0 && (
        <div style={card}>
          <div className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-strong)' }}>Experience</div>
          <div className="flex flex-col gap-2.5">
            {profile.experience.map((x, i) => (
              <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 11, padding: 12 }}>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text-strong)' }}>{x.title || 'Role'}</div>
                <div className="text-[12px] mt-px" style={{ color: 'var(--text-secondary)' }}>{[x.company, [x.startDate, x.endDate].filter(Boolean).join('–')].filter(Boolean).join(' · ')}</div>
                {x.description?.trim() && <div className="j4u-doc text-[12px] mt-1.5" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: md(x.description) }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* languages */}
      {profile.languages.length > 0 && (
        <div style={card}>
          <div className="text-[13px] font-bold mb-3" style={{ color: 'var(--text-strong)' }}>Languages</div>
          <div className="flex flex-wrap gap-1.5">{profile.languages.map((l, i) => <span key={i} className="text-[12px]" style={{ padding: '5px 12px', borderRadius: 9999, background: 'var(--surface-sunken)', color: 'var(--text)' }}>{l.name}{l.level ? ` · ${l.level}` : ''}</span>)}</div>
        </div>
      )}

      {/* settings entry */}
      <button onClick={onOpenSettings} className="j4u-press w-full flex items-center gap-3" style={{ ...card, padding: '15px 16px' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 4.6h.09A1.65 1.65 0 0 0 11 2.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 10v.09a2 2 0 0 1 0 4z" /></svg>
        <span className="flex-1 text-left text-[13.5px] font-semibold" style={{ color: 'var(--text-strong)' }}>Settings · AI engine &amp; privacy</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>

      {toast && <div className="j4u-rise" style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 90, background: 'var(--text-strong)', color: '#fff', padding: '10px 16px', borderRadius: 11, fontSize: 12.5, fontWeight: 500, boxShadow: 'var(--shadow-overlay)' }}>{toast}</div>}
      {linkedinOpen && <LinkedinImportModal onApply={async (m) => { setLinkedinOpen(false); try { setProfile(await saveProfile(m)); flash('LinkedIn merged & saved'); } catch { setProfile(m); } }} onClose={() => setLinkedinOpen(false)} />}
      {assistantOpen && <ProfileAssistant onClose={() => setAssistantOpen(false)} onApplied={(p) => { setProfile(p); flash('Profile updated'); }} />}
      {cvOpen && <CvExportModal profile={profile} onClose={() => setCvOpen(false)} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ minHeight: 40, border: '1px solid var(--border)', borderRadius: 9, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}
