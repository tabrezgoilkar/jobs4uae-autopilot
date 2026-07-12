import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  getProfile,
  saveProfile,
  importCv,
  type Profile,
} from '../api';
import { Card, PageHeader } from '../components/ui';
import { IconSparkle } from '../components/icons';
import { RadialGauge } from '../components/charts';
import { analyzeProfile, type ProfileSection } from '../lib/profileStrength';
import { extractSkills } from '../lib/skillsExtract';
import { formatBullets } from '../lib/bullets';
import LinkedinImportModal from '../components/LinkedinImportModal';
import ProfileAssistant from '../components/ProfileAssistant';
import CvExportModal from '../features/cv/CvExportModal';

const FIELD = 'mt-1 w-full rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-[12.5px] font-medium text-ink-secondary';

type EditKey = string | null; // 'basics' | 'exp:0' | 'edu:1' | 'proj:0' | 'cert:0' | 'lang:0' | 'award:0'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [snapshot, setSnapshot] = useState<Profile | null>(null); // pre-edit copy for Cancel
  const [editKey, setEditKey] = useState<EditKey>(null);
  const [loadError, setLoadError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [suggest, setSuggest] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getProfile().then(setProfile).catch(() => setLoadError(true)); }, []);

  function startEdit(key: string) {
    setSnapshot(profile);
    setEditKey(key);
    setMessage(null);
  }
  function cancelEdit() {
    if (snapshot) setProfile(snapshot);
    setSnapshot(null);
    setEditKey(null);
  }
  async function saveEdit() {
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setSnapshot(null);
      setEditKey(null);
      setMessage({ ok: true, text: 'Saved.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function patch(p: Partial<Profile>) { setProfile((cur) => (cur ? { ...cur, ...p } : cur)); }
  function patchItem<K extends 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards'>(section: K, i: number, fields: Record<string, unknown>) {
    setProfile((cur) => {
      if (!cur) return cur;
      const arr = (cur[section] as unknown as Record<string, unknown>[]).map((x, idx) => (idx === i ? { ...x, ...fields } : x));
      return { ...cur, [section]: arr } as Profile;
    });
  }
  function addItem(section: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards', blank: unknown, prefix: string) {
    if (!profile) return;
    const i = (profile[section] as unknown[]).length;
    setSnapshot(profile);
    setProfile({ ...profile, [section]: [...(profile[section] as unknown[]), blank] } as Profile);
    setEditKey(`${prefix}:${i}`);
    setMessage(null);
  }
  function removeItem(section: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards', i: number) {
    if (!profile) return;
    setProfile({ ...profile, [section]: (profile[section] as unknown[]).filter((_, idx) => idx !== i) } as Profile);
    setSnapshot(null);
    setEditKey(null);
    // persist the removal immediately
    saveProfile({ ...profile, [section]: (profile[section] as unknown[]).filter((_, idx) => idx !== i) } as Profile)
      .then((s) => { setProfile(s); setMessage({ ok: true, text: 'Removed.' }); })
      .catch(() => setMessage({ ok: false, text: 'Could not remove. Try again.' }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setMessage(null);
    try {
      const parsed = await importCv(file);
      const saved = await saveProfile(parsed);
      setProfile(saved);
      setMessage({ ok: true, text: 'CV imported & saved. Review each section and edit anything.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onLinkedinApply(merged: Profile) {
    setLinkedinOpen(false);
    try {
      const saved = await saveProfile(merged);
      setProfile(saved);
      setMessage({ ok: true, text: 'LinkedIn details merged & saved.' });
    } catch {
      setProfile(merged);
      setMessage({ ok: false, text: 'Merged locally but could not save — press an Edit then Save to persist.' });
    }
  }

  function onFix(section: ProfileSection) {
    if (!profile) return;
    if (section === 'basics') { startEdit('basics'); scrollTo('sec-basics'); return; }
    const map: Record<string, { key: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards'; blank: unknown; prefix: string }> = {
      experience: { key: 'experience', blank: { company: '', title: '', startDate: '', endDate: '', description: '' }, prefix: 'exp' },
      projects: { key: 'projects', blank: { name: '', description: '', tech: [], url: '' }, prefix: 'proj' },
      certifications: { key: 'certifications', blank: { name: '', issuer: '', year: '', url: '' }, prefix: 'cert' },
      languages: { key: 'languages', blank: { name: '', level: '' }, prefix: 'lang' },
      awards: { key: 'awards', blank: { title: '', issuer: '', year: '', description: '' }, prefix: 'award' },
      education: { key: 'education', blank: { institution: '', degree: '', field: '', year: '' }, prefix: 'edu' },
    };
    const m = map[section];
    if (!m) return;
    if ((profile[m.key] as unknown[]).length === 0) addItem(m.key, m.blank, m.prefix);
    else startEdit(`${m.prefix}:0`);
    scrollTo(`sec-${section}`);
  }
  function scrollTo(id: string) {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  if (loadError) {
    return <div role="alert" className="text-sm rounded-md p-3 bg-danger-soft text-danger-text border border-danger-soft">Could not load your profile. Make sure the server is running, then refresh.</div>;
  }
  if (!profile) return <div className="text-ink-muted text-sm">Loading…</div>;

  const editor = { editKey, startEdit, cancelEdit, saveEdit, saving, patch, patchItem, addItem, removeItem, profile, suggest, setSuggest };

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Edit any section independently — like LinkedIn. Import a CV or LinkedIn to fill it fast." />

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-hair text-ink-secondary text-xs font-semibold j4u-chip cursor-pointer">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={importing} className="hidden" />
            {importing ? 'Reading CV…' : 'Import from a CV file'}
          </label>
          <button type="button" onClick={() => setLinkedinOpen(true)} className="j4u-chip inline-flex items-center gap-2 h-9 px-3 rounded-md border border-hair text-ink-secondary text-xs font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.8-2.05 4.06 0 4.8 2.67 4.8 6.14V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" /></svg>
            Import from LinkedIn
          </button>
          <button type="button" onClick={() => setCvOpen(true)} className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary-600 text-white text-xs font-semibold j4u-press">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></svg>
            View / export CV
          </button>
        </div>
      </Card>

      {message && (
        <div role="status" className={`text-sm rounded-md p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>{message.text}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-[18px] items-start">
        <div className="space-y-5 min-w-0">
          <BasicsCard {...editor} />
          <ExperienceCard {...editor} />
          <EducationCard {...editor} />
          <ProjectsCard {...editor} />
          <CertificationsCard {...editor} />
          <LanguagesCard {...editor} />
          <AwardsCard {...editor} />
        </div>
        <ProfileRail profile={profile} onFix={onFix} onImprove={() => setAssistantOpen(true)} />
      </div>

      {cvOpen && <CvExportModal profile={profile} onClose={() => setCvOpen(false)} />}
      {linkedinOpen && <LinkedinImportModal onApply={onLinkedinApply} onClose={() => setLinkedinOpen(false)} />}
      {assistantOpen && (
        <ProfileAssistant
          onClose={() => setAssistantOpen(false)}
          onApplied={(p) => { setProfile(p); setMessage({ ok: true, text: 'Assistant updated your profile.' }); }}
        />
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

function renderMd(text: string) {
  const md = text.replace(/\s*[••‣◦⁃∙]\s+/g, '\n- ');
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
}
function RichText({ text }: { text: string }) {
  return <div className="j4u-doc text-[13px] text-ink-secondary" dangerouslySetInnerHTML={{ __html: renderMd(text) }} />;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-hair bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-secondary">{children}</span>;
}
function PencilBtn({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="j4u-chip inline-flex items-center gap-1 h-7 px-2 rounded-md border border-hair text-[11.5px] font-semibold text-ink-secondary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      {label}
    </button>
  );
}
function AddBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>;
}
function EditActions({ onSave, onCancel, onRemove, saving }: { onSave: () => void; onCancel: () => void; onRemove?: () => void; saving: boolean }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button onClick={onSave} disabled={saving} className="j4u-press text-[12.5px] font-semibold text-white bg-primary-600 rounded-md px-3.5 h-9 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
      <button onClick={onCancel} className="j4u-chip text-[12.5px] font-semibold text-ink-secondary border border-hair rounded-md px-3.5 h-9">Cancel</button>
      {onRemove && <button onClick={onRemove} className="text-[12.5px] font-medium text-danger-text ml-auto">Remove</button>}
    </div>
  );
}

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthYear({ value, onChange, allowPresent }: { value: string; onChange: (v: string) => void; allowPresent?: boolean }) {
  const present = value === 'Present';
  const [yr, mo] = present || !value ? ['', ''] : value.includes('-') ? value.split('-') : [value, ''];
  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowYear + 1; y >= 1970; y--) years.push(y);
  const emit = (year: string, month: string) => onChange(year ? (month ? `${year}-${month}` : year) : '');
  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      {allowPresent && (
        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary mr-1">
          <input type="checkbox" checked={present} onChange={(e) => onChange(e.target.checked ? 'Present' : '')} /> Present
        </label>
      )}
      {!present && (
        <>
          <select className="rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus" value={mo} onChange={(e) => emit(yr || String(nowYear), e.target.value)}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_LABEL[i]}</option>)}
          </select>
          <select className="rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus" value={yr} onChange={(e) => emit(e.target.value, mo)}>
            <option value="">Year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

interface EditorCtx {
  editKey: EditKey;
  startEdit: (key: string) => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  saving: boolean;
  patch: (p: Partial<Profile>) => void;
  patchItem: (section: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards', i: number, fields: Record<string, unknown>) => void;
  addItem: (section: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards', blank: unknown, prefix: string) => void;
  removeItem: (section: 'experience' | 'education' | 'projects' | 'certifications' | 'languages' | 'awards', i: number) => void;
  profile: Profile;
  suggest: string[];
  setSuggest: (s: string[]) => void;
}

/* ---------- Basics ---------- */
function BasicsCard(c: EditorCtx) {
  const p = c.profile;
  const editing = c.editKey === 'basics';
  const contact = [p.email, p.phone, p.location].filter((s) => s?.trim());
  return (
    <Card>
      <div id="sec-basics" className="scroll-mt-20">
        {!editing ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl font-bold text-ink-strong tracking-tight">{p.fullName || 'Your name'}</div>
              {p.headline && <div className="text-[15px] text-primary-700 font-medium mt-0.5">{p.headline}</div>}
              {contact.length > 0 && <div className="mt-2 text-[13px] text-ink-secondary">{contact.join('  ·  ')}</div>}
              {p.summary?.trim() && <div className="mt-3"><RichText text={p.summary} /></div>}
              {p.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.skills.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>}
            </div>
            <PencilBtn onClick={() => c.startEdit('basics')} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={LABEL}>Full name</span><input className={FIELD} value={p.fullName} onChange={(e) => c.patch({ fullName: e.target.value })} /></label>
            <label className="block"><span className={LABEL}>Headline / current title</span><input className={FIELD} value={p.headline} onChange={(e) => c.patch({ headline: e.target.value })} /></label>
            <label className="block"><span className={LABEL}>Email</span><input className={FIELD} value={p.email} onChange={(e) => c.patch({ email: e.target.value })} /></label>
            <label className="block"><span className={LABEL}>Phone</span><input className={FIELD} value={p.phone} onChange={(e) => c.patch({ phone: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className={LABEL}>Location</span><input className={FIELD} value={p.location} onChange={(e) => c.patch({ location: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className={LABEL}>Professional summary</span><textarea className={FIELD} rows={3} value={p.summary} onChange={(e) => c.patch({ summary: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className={LABEL}>Skills (comma separated)</span>
              <div className="flex items-center justify-between mt-1">
                <input className={FIELD} value={p.skills.join(', ')} onChange={(e) => c.patch({ skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                <button type="button" onClick={() => c.setSuggest(extractSkills(p))} className="j4u-chip ml-2 inline-flex items-center gap-1 h-9 px-2.5 rounded-md border border-ai-soft bg-ai-soft text-[11.5px] font-semibold text-ai-700 shrink-0">
                  <IconSparkle size={12} color="var(--ai-600)" /> Suggest
                </button>
              </div>
              {c.suggest.length > 0 && (
                <div className="mt-2 rounded-md border border-hair bg-surface-sunken p-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">Suggested from your experience — click to add</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.suggest.map((s) => (
                      <button key={s} type="button" onClick={() => { const next = [...p.skills, s]; c.patch({ skills: next }); c.setSuggest(c.suggest.filter((x) => x !== s)); }} className="inline-flex items-center gap-1 rounded-full border border-ai-soft bg-ai-soft px-2.5 py-0.5 text-xs text-ai-700 hover:bg-ai-600 hover:text-white">
                        + {s}
                      </button>
                    ))}
                  </div>
                  {c.suggest.length === 0 && <div className="text-[12px] text-ink-muted">All detected skills are already in your list. 🎉</div>}
                </div>
              )}
            </label>
            <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} saving={c.saving} /></div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Experience ---------- */
function ExperienceCard(c: EditorCtx) {
  const items = c.profile.experience;
  return (
    <Card title="Experience" action={<AddBtn onClick={() => c.addItem('experience', { company: '', title: '', startDate: '', endDate: '', description: '' }, 'exp')} />}>
      <div id="sec-experience" className="space-y-4 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No experience yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `exp:${i}` ? (
          <ExperienceEditor key={i} c={c} x={x} i={i} />
        ) : (
          <div key={i} className="flex items-start justify-between gap-3 border-l-2 border-hair pl-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink-strong">{x.title || 'Role'}{x.company ? ` · ${x.company}` : ''}</div>
              {[x.startDate, x.endDate].filter(Boolean).length > 0 && <div className="text-xs text-ink-muted">{[x.startDate, x.endDate].filter(Boolean).join(' – ')}</div>}
              {x.description?.trim() && <RichText text={x.description} />}
            </div>
            <PencilBtn onClick={() => c.startEdit(`exp:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ExperienceEditor({ c, x, i }: { c: EditorCtx; x: import('../api').Experience; i: number }) {
  const [preview, setPreview] = useState<{ before: string; after: string; changed: number } | null>(null);
  const runFormat = () => {
    const res = formatBullets(x.description);
    if (res.changed === 0) { setPreview(null); return; }
    setPreview({ before: x.description, after: res.text, changed: res.changed });
  };
  const applyFormat = () => {
    if (preview) { c.patchItem('experience', i, { description: preview.after }); setPreview(null); }
  };
  return (
    <div className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
      <input className={FIELD} aria-label="Job title" placeholder="Job title" value={x.title} onChange={(e) => c.patchItem('experience', i, { title: e.target.value })} />
      <input className={FIELD} aria-label="Company" placeholder="Company" value={x.company} onChange={(e) => c.patchItem('experience', i, { company: e.target.value })} />
      <div><span className={LABEL}>Start</span><MonthYear value={x.startDate} onChange={(v) => c.patchItem('experience', i, { startDate: v })} /></div>
      <div><span className={LABEL}>End</span><MonthYear value={x.endDate} onChange={(v) => c.patchItem('experience', i, { endDate: v })} allowPresent /></div>
      <div className="sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className={LABEL}>What you did — one bullet per line; you can use - and **bold**</span>
          <button type="button" onClick={runFormat} className="j4u-chip inline-flex items-center gap-1 h-7 px-2 rounded-md border border-ai-soft bg-ai-soft text-[11px] font-semibold text-ai-700">
            <IconSparkle size={12} color="var(--ai-600)" /> Format bullets
          </button>
        </div>
        <textarea className={`${FIELD} mt-1`} rows={4} aria-label="What you did" placeholder="What you did — one bullet per line; you can use - and **bold**" value={x.description} onChange={(e) => { c.patchItem('experience', i, { description: e.target.value }); setPreview(null); }} />
        {preview && (
          <div className="mt-2 rounded-md border border-hair bg-surface-sunken p-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Preview formatting — {preview.changed} line(s) changed</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded border border-danger-soft bg-danger-soft/40 p-2 text-[12px] text-danger-text whitespace-pre-wrap max-h-40 overflow-auto line-through decoration-danger-text/50">{preview.before}</div>
              <div className="rounded border border-success-soft bg-success-soft/40 p-2 text-[12px] text-success-text whitespace-pre-wrap max-h-40 overflow-auto">{preview.after}</div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={applyFormat} className="j4u-press text-[12px] font-semibold text-white bg-primary-600 rounded-md px-3 h-8">Apply formatting</button>
              <button type="button" onClick={() => setPreview(null)} className="j4u-chip text-[12px] font-semibold text-ink-secondary border border-hair rounded-md px-3 h-8">Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('experience', i)} saving={c.saving} /></div>
    </div>
  );
}

/* ---------- Education ---------- */
function EducationCard(c: EditorCtx) {
  const items = c.profile.education;
  return (
    <Card title="Education" action={<AddBtn onClick={() => c.addItem('education', { institution: '', degree: '', field: '', year: '' }, 'edu')} />}>
      <div id="sec-education" className="space-y-4 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No education yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `edu:${i}` ? (
          <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
            <input className={FIELD} aria-label="Institution" placeholder="Institution" value={x.institution} onChange={(e) => c.patchItem('education', i, { institution: e.target.value })} />
            <input className={FIELD} aria-label="Degree" placeholder="Degree" value={x.degree} onChange={(e) => c.patchItem('education', i, { degree: e.target.value })} />
            <input className={FIELD} aria-label="Field" placeholder="Field" value={x.field} onChange={(e) => c.patchItem('education', i, { field: e.target.value })} />
            <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => c.patchItem('education', i, { year: e.target.value })} />
            <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('education', i)} saving={c.saving} /></div>
          </div>
        ) : (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink-strong">{[x.degree, x.field].filter(Boolean).join(', ') || x.institution || 'Education'}</div>
              <div className="text-[13px] text-ink-secondary">{[x.institution, x.year].filter(Boolean).join('  ·  ')}</div>
            </div>
            <PencilBtn onClick={() => c.startEdit(`edu:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Projects ---------- */
function ProjectsCard(c: EditorCtx) {
  const items = c.profile.projects;
  return (
    <Card title="Projects" action={<AddBtn onClick={() => c.addItem('projects', { name: '', description: '', tech: [], url: '' }, 'proj')} />}>
      <div id="sec-projects" className="space-y-4 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No projects yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `proj:${i}` ? (
          <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
            <input className={FIELD} aria-label="Project name" placeholder="Project name" value={x.name} onChange={(e) => c.patchItem('projects', i, { name: e.target.value })} />
            <input className={FIELD} aria-label="Link" placeholder="Link (optional)" value={x.url} onChange={(e) => c.patchItem('projects', i, { url: e.target.value })} />
            <textarea className={`${FIELD} sm:col-span-2`} rows={3} aria-label="Description" placeholder="What it is and your impact" value={x.description} onChange={(e) => c.patchItem('projects', i, { description: e.target.value })} />
            <input className={`${FIELD} sm:col-span-2`} aria-label="Tech" placeholder="Tech (comma separated)" value={x.tech.join(', ')} onChange={(e) => c.patchItem('projects', i, { tech: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('projects', i)} saving={c.saving} /></div>
          </div>
        ) : (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink-strong">{x.name || 'Project'}{x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="ml-2 text-[12px] text-primary-700 font-medium">link ↗</a> : null}</div>
              {x.description?.trim() && <RichText text={x.description} />}
              {x.tech.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{x.tech.map((t, j) => <Chip key={j}>{t}</Chip>)}</div>}
            </div>
            <PencilBtn onClick={() => c.startEdit(`proj:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Certifications ---------- */
function CertificationsCard(c: EditorCtx) {
  const items = c.profile.certifications;
  return (
    <Card title="Certifications" action={<AddBtn onClick={() => c.addItem('certifications', { name: '', issuer: '', year: '', url: '' }, 'cert')} />}>
      <div id="sec-certifications" className="space-y-3 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No certifications yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `cert:${i}` ? (
          <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
            <input className={FIELD} aria-label="Certification" placeholder="Certification" value={x.name} onChange={(e) => c.patchItem('certifications', i, { name: e.target.value })} />
            <input className={FIELD} aria-label="Issuer" placeholder="Issuer" value={x.issuer} onChange={(e) => c.patchItem('certifications', i, { issuer: e.target.value })} />
            <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => c.patchItem('certifications', i, { year: e.target.value })} />
            <input className={FIELD} aria-label="Link" placeholder="Credential link (optional)" value={x.url} onChange={(e) => c.patchItem('certifications', i, { url: e.target.value })} />
            <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('certifications', i)} saving={c.saving} /></div>
          </div>
        ) : (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="text-[13px] text-ink-secondary min-w-0"><span className="font-semibold text-ink-strong">{x.name}</span>{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}</div>
            <PencilBtn onClick={() => c.startEdit(`cert:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Languages ---------- */
function LanguagesCard(c: EditorCtx) {
  const items = c.profile.languages;
  return (
    <Card title="Languages" action={<AddBtn onClick={() => c.addItem('languages', { name: '', level: '' }, 'lang')} />}>
      <div id="sec-languages" className="space-y-3 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No languages yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `lang:${i}` ? (
          <div key={i} className="border border-hair-subtle rounded-md p-3 flex items-center gap-2 flex-wrap">
            <input className={FIELD} aria-label="Language" placeholder="Language" value={x.name} onChange={(e) => c.patchItem('languages', i, { name: e.target.value })} />
            <input className={FIELD} aria-label="Level" placeholder="Level (e.g. Native, Fluent)" value={x.level} onChange={(e) => c.patchItem('languages', i, { level: e.target.value })} />
            <div className="w-full"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('languages', i)} saving={c.saving} /></div>
          </div>
        ) : (
          <div key={i} className="flex items-center justify-between gap-3">
            <Chip>{x.name}{x.level ? ` · ${x.level}` : ''}</Chip>
            <PencilBtn onClick={() => c.startEdit(`lang:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Awards ---------- */
function AwardsCard(c: EditorCtx) {
  const items = c.profile.awards;
  return (
    <Card title="Awards & honors" action={<AddBtn onClick={() => c.addItem('awards', { title: '', issuer: '', year: '', description: '' }, 'award')} />}>
      <div id="sec-awards" className="space-y-3 scroll-mt-20">
        {items.length === 0 && <p className="text-sm text-ink-muted">No awards yet — click + Add.</p>}
        {items.map((x, i) => c.editKey === `award:${i}` ? (
          <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
            <input className={FIELD} aria-label="Award" placeholder="Award" value={x.title} onChange={(e) => c.patchItem('awards', i, { title: e.target.value })} />
            <input className={FIELD} aria-label="Issuer" placeholder="Issuer / event" value={x.issuer} onChange={(e) => c.patchItem('awards', i, { issuer: e.target.value })} />
            <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => c.patchItem('awards', i, { year: e.target.value })} />
            <input className={FIELD} aria-label="Description" placeholder="One line about it" value={x.description} onChange={(e) => c.patchItem('awards', i, { description: e.target.value })} />
            <div className="sm:col-span-2"><EditActions onSave={c.saveEdit} onCancel={c.cancelEdit} onRemove={() => c.removeItem('awards', i)} saving={c.saving} /></div>
          </div>
        ) : (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="text-[13px] text-ink-secondary min-w-0"><span className="font-semibold text-ink-strong">{x.title}</span>{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}{x.description?.trim() && <div className="text-[12.5px] text-ink-muted">{x.description}</div>}</div>
            <PencilBtn onClick={() => c.startEdit(`award:${i}`)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Copilot rail ---------- */
function ProfileRail({ profile, onFix, onImprove }: { profile: Profile; onFix: (s: ProfileSection) => void; onImprove: () => void }) {
  const { score, quality, completeness, factors, suggestions } = useMemo(() => analyzeProfile(profile), [profile]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = suggestions.filter((s) => !dismissed.has(s.title));
  const label = score >= 85 ? 'Excellent — strong across the board.'
    : score >= 65 ? 'Strong — a few tweaks lift your match.'
    : score >= 40 ? 'Getting there — fill the gaps below.'
    : 'Just started — add the basics.';
  return (
    <aside className="lg:sticky lg:top-[18px] bg-surface border border-ai-soft rounded-md overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3.5 j4u-grad-ai border-b border-ai-soft">
        <IconSparkle size={16} color="var(--ai-600)" />
        <span className="text-[13.5px] font-bold text-ink-strong">Profile copilot</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <RadialGauge value={score} size={56} stroke={6} color="var(--ai-600)"><span className="text-sm font-bold text-ink-strong">{score}%</span></RadialGauge>
          <div>
            <div className="text-[13px] font-bold text-ink-strong">Profile strength</div>
            <div className="text-[11.5px] text-ink-secondary mt-0.5 leading-snug">{label}</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-2 gap-1.5">
            <div className="rounded-md bg-surface-sunken px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">Completeness</div>
              <div className="text-[13px] font-bold text-ink-strong">{completeness}<span className="text-[10px] font-normal text-ink-muted">/46</span></div>
            </div>
            <div className="rounded-md bg-surface-sunken px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">Quality</div>
              <div className="text-[13px] font-bold text-ink-strong">{quality}<span className="text-[10px] font-normal text-ink-muted">/54</span></div>
            </div>
          </div>
        </div>
        <button onClick={() => setShowBreakdown((v) => !v)} className="j4u-chip mt-2 w-full inline-flex items-center justify-between gap-1 text-[11px] font-semibold text-ai-700 rounded-md px-2.5 py-1.5 border border-ai-soft bg-ai-soft">
          <span>Why this score</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {showBreakdown && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {factors.map((f) => {
              const pct = f.max ? Math.round((f.earned / f.max) * 100) : 0;
              const color = pct >= 75 ? 'var(--success)' : pct >= 40 ? 'var(--ai-600)' : 'var(--danger)';
              return (
                <li key={f.key} className="text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-strong truncate">{f.label}</span>
                    <span className="text-ink-muted tabular-nums whitespace-nowrap">{f.earned}/{f.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-sunken mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="text-[10.5px] text-ink-muted mt-0.5 leading-snug">{f.note}</div>
                </li>
              );
            })}
          </ul>
        )}
        <button onClick={onImprove} className="j4u-press mt-3 w-full inline-flex items-center justify-center gap-2 h-9 rounded-md bg-ai-600 text-white text-[12.5px] font-semibold">
          <IconSparkle size={14} color="#fff" /> Improve with AI
        </button>
        <div className="text-[10px] font-bold tracking-wide uppercase text-ai-700 mt-[18px] mb-2.5">Suggestions</div>
        {visible.length === 0 ? (
          <p className="text-[12px] text-ink-muted">Nothing outstanding — nice work! 🎉</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((s) => (
              <div key={s.title} className="border border-ai-soft bg-ai-soft rounded-[11px] px-3 py-2.5">
                <div className="text-[12.5px] font-semibold text-ink-strong leading-snug">{s.title}</div>
                <div className="text-[11.5px] text-ink-secondary mt-0.5 leading-snug">{s.detail}</div>
                <div className="flex gap-1.5 mt-2.5">
                  <button onClick={() => onFix(s.section)} className="j4u-press text-[11.5px] font-semibold text-white bg-ai-600 rounded-md px-2.5 py-1">Add / fix</button>
                  <button onClick={() => setDismissed((d) => new Set(d).add(s.title))} className="j4u-chip text-[11.5px] font-semibold text-ink-secondary border border-hair rounded-md px-2.5 py-1">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
