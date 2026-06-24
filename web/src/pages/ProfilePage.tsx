import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getProfile,
  saveProfile,
  importCv,
  type Profile,
  type Experience,
  type Education,
} from '../api';
import { Card, PageHeader, Button } from '../components/ui';
import { IconSparkle } from '../components/icons';
import { RadialGauge } from '../components/charts';
import { analyzeProfile, type ProfileSection } from '../lib/profileStrength';
import LinkedinImportModal from '../components/LinkedinImportModal';

const FIELD = 'mt-1 w-full rounded-md border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-sm font-medium text-ink-secondary';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setLoadError(true));
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  function onLinkedinApply(merged: Profile) {
    setProfile(merged);
    setLinkedinOpen(false);
    setEditing(true);
    setMessage({ ok: true, text: 'LinkedIn profile merged in. Review the details below, then Save.' });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const parsed = await importCv(file);
      setProfile(parsed);
      setEditing(true);
      setMessage({ ok: true, text: 'CV imported! Review the details below, then Save.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setEditing(false);
      setMessage({ ok: true, text: 'Profile saved.' });
    } catch {
      setMessage({ ok: false, text: 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  function updateExp(i: number, key: keyof Experience, value: string) {
    if (!profile) return;
    const experience = profile.experience.map((x, idx) => (idx === i ? { ...x, [key]: value } : x));
    set('experience', experience);
  }
  function addExp() {
    if (!profile) return;
    set('experience', [...profile.experience, { company: '', title: '', startDate: '', endDate: '', description: '' }]);
  }
  function removeExp(i: number) {
    if (!profile) return;
    set('experience', profile.experience.filter((_, idx) => idx !== i));
  }

  function updateEdu(i: number, key: keyof Education, value: string) {
    if (!profile) return;
    const education = profile.education.map((x, idx) => (idx === i ? { ...x, [key]: value } : x));
    set('education', education);
  }
  function addEdu() {
    if (!profile) return;
    set('education', [...profile.education, { institution: '', degree: '', field: '', year: '' }]);
  }
  function removeEdu(i: number) {
    if (!profile) return;
    set('education', profile.education.filter((_, idx) => idx !== i));
  }

  type ListKey = 'projects' | 'certifications' | 'languages' | 'awards';
  function listAdd(key: ListKey, blank: unknown) {
    setProfile((p) => (p ? { ...p, [key]: [...(p[key] as unknown[]), blank] } as Profile : p));
  }
  function listUpd(key: ListKey, i: number, patch: Record<string, unknown>) {
    if (!profile) return;
    set(key, (profile[key] as unknown as Record<string, unknown>[]).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) as never);
  }
  function listDel(key: ListKey, i: number) {
    if (!profile) return;
    set(key, (profile[key] as unknown[]).filter((_, idx) => idx !== i) as never);
  }

  // Jump into edit mode at the relevant section (used by the copilot suggestions).
  function onFix(section: ProfileSection) {
    setEditing(true);
    if (profile) {
      if (section === 'experience' && profile.experience.length === 0) addExp();
      if (section === 'projects' && profile.projects.length === 0) listAdd('projects', { name: '', description: '', tech: [], url: '' });
      if (section === 'certifications' && profile.certifications.length === 0) listAdd('certifications', { name: '', issuer: '', year: '', url: '' });
      if (section === 'languages' && profile.languages.length === 0) listAdd('languages', { name: '', level: '' });
      if (section === 'awards' && profile.awards.length === 0) listAdd('awards', { title: '', issuer: '', year: '', description: '' });
    }
    window.setTimeout(() => {
      document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  if (loadError) {
    return (
      <div role="alert" className="text-sm rounded-md p-3 bg-danger-soft text-danger-text border border-danger-soft">
        Could not load your profile. Make sure the server is running, then refresh this page.
      </div>
    );
  }
  if (!profile) {
    return <div className="text-ink-muted text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="My profile" subtitle={editing ? 'Edit your details, then Save.' : 'Your profile at a glance. Click Edit to change anything.'} />
        <div className="flex items-center gap-2 pt-1">
          {editing ? (
            <Button onClick={onSave} disabled={saving || importing}>{saving ? 'Saving…' : 'Save'}</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit profile</Button>
          )}
          {editing && <button onClick={() => setEditing(false)} className="j4u-chip text-sm font-semibold text-ink-secondary border border-hair rounded-md px-3 h-9">View</button>}
        </div>
      </div>

      {message && (
        <div role="status" className={`text-sm rounded-md p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-[18px] items-start">
        <div className="space-y-6 min-w-0">
          {editing ? (
            <EditForm
              profile={profile}
              fileRef={fileRef}
              importing={importing}
              onFile={onFile}
              openLinkedin={() => setLinkedinOpen(true)}
              set={set}
              updateExp={updateExp} addExp={addExp} removeExp={removeExp}
              updateEdu={updateEdu} addEdu={addEdu} removeEdu={removeEdu}
              listAdd={listAdd} listUpd={listUpd} listDel={listDel}
            />
          ) : (
            <ProfileView profile={profile} onEdit={() => setEditing(true)} />
          )}
        </div>
        <ProfileRail profile={profile} onFix={onFix} />
      </div>

      {linkedinOpen && <LinkedinImportModal onApply={onLinkedinApply} onClose={() => setLinkedinOpen(false)} />}
    </div>
  );
}

/* ---------- Read-only view ---------- */

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-hair bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-secondary">{children}</span>;
}

function dateRange(a?: string, b?: string) {
  return [a, b].filter(Boolean).join(' – ');
}

function ProfileView({ profile: p, onEdit }: { profile: Profile; onEdit: () => void }) {
  const empty = !p.fullName?.trim() && p.experience.length === 0 && p.skills.length === 0;
  if (empty) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-[15px] font-semibold text-ink-strong">Your profile is empty</div>
          <p className="mt-1 text-sm text-ink-muted">Import your CV or LinkedIn, or add details by hand.</p>
          <div className="mt-4"><Button onClick={onEdit}>Add your details</Button></div>
        </div>
      </Card>
    );
  }
  const contact = [p.email, p.phone, p.location].filter((s) => s?.trim());
  return (
    <div className="space-y-5">
      <Card>
        <div className="text-2xl font-bold text-ink-strong tracking-tight">{p.fullName || 'Unnamed'}</div>
        {p.headline && <div className="text-[15px] text-primary-700 font-medium mt-0.5">{p.headline}</div>}
        {contact.length > 0 && <div className="mt-2 text-[13px] text-ink-secondary">{contact.join('  ·  ')}</div>}
        {p.summary?.trim() && <p className="mt-3 text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{p.summary}</p>}
        {p.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">{p.skills.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>
        )}
      </Card>

      {p.experience.length > 0 && (
        <Card title="Experience">
          <div className="space-y-4">
            {p.experience.map((x, i) => (
              <div key={i} className="border-l-2 border-hair pl-3">
                <div className="text-[14px] font-semibold text-ink-strong">{x.title || 'Role'}{x.company ? ` · ${x.company}` : ''}</div>
                {dateRange(x.startDate, x.endDate) && <div className="text-xs text-ink-muted">{dateRange(x.startDate, x.endDate)}</div>}
                {x.description?.trim() && <p className="mt-1 text-[13px] text-ink-secondary leading-relaxed whitespace-pre-wrap">{x.description}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.education.length > 0 && (
        <Card title="Education">
          <div className="space-y-3">
            {p.education.map((x, i) => (
              <div key={i}>
                <div className="text-[14px] font-semibold text-ink-strong">{[x.degree, x.field].filter(Boolean).join(', ') || x.institution}</div>
                <div className="text-[13px] text-ink-secondary">{[x.institution, x.year].filter(Boolean).join('  ·  ')}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.projects.length > 0 && (
        <Card title="Projects">
          <div className="space-y-3">
            {p.projects.map((x, i) => (
              <div key={i}>
                <div className="text-[14px] font-semibold text-ink-strong">{x.name}{x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="ml-2 text-[12px] text-primary-700 font-medium">link ↗</a> : null}</div>
                {x.description?.trim() && <p className="text-[13px] text-ink-secondary leading-relaxed">{x.description}</p>}
                {x.tech.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{x.tech.map((t, j) => <Chip key={j}>{t}</Chip>)}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.certifications.length > 0 && (
        <Card title="Certifications">
          <div className="space-y-2">
            {p.certifications.map((x, i) => (
              <div key={i} className="text-[13px] text-ink-secondary">
                <span className="font-semibold text-ink-strong">{x.name}</span>{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.languages.length > 0 && (
        <Card title="Languages">
          <div className="flex flex-wrap gap-1.5">{p.languages.map((x, i) => <Chip key={i}>{x.name}{x.level ? ` · ${x.level}` : ''}</Chip>)}</div>
        </Card>
      )}

      {p.awards.length > 0 && (
        <Card title="Awards & honors">
          <div className="space-y-2">
            {p.awards.map((x, i) => (
              <div key={i} className="text-[13px] text-ink-secondary">
                <span className="font-semibold text-ink-strong">{x.title}</span>{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}
                {x.description?.trim() && <div className="text-[12.5px] text-ink-muted">{x.description}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Editable form ---------- */

interface EditFormProps {
  profile: Profile;
  fileRef: React.RefObject<HTMLInputElement | null>;
  importing: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openLinkedin: () => void;
  set: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  updateExp: (i: number, key: keyof Experience, value: string) => void;
  addExp: () => void; removeExp: (i: number) => void;
  updateEdu: (i: number, key: keyof Education, value: string) => void;
  addEdu: () => void; removeEdu: (i: number) => void;
  listAdd: (key: 'projects' | 'certifications' | 'languages' | 'awards', blank: unknown) => void;
  listUpd: (key: 'projects' | 'certifications' | 'languages' | 'awards', i: number, patch: Record<string, unknown>) => void;
  listDel: (key: 'projects' | 'certifications' | 'languages' | 'awards', i: number) => void;
}

function EditForm(props: EditFormProps) {
  const { profile, fileRef, importing, onFile, openLinkedin, set, updateExp, addExp, removeExp, updateEdu, addEdu, removeEdu, listAdd, listUpd, listDel } = props;
  return (
    <>
      <Card>
        <label className="block">
          <span className={LABEL}>Import from a CV file (PDF, Word, or text)</span>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={importing} className="mt-2 block text-sm text-ink-secondary" />
        </label>
        {importing && <p className="mt-2 text-sm text-primary-700">Reading your CV with AI… this can take a few seconds.</p>}
        <div className="mt-3 pt-3 border-t border-hair-subtle flex items-center gap-3 flex-wrap">
          <span className="text-xs text-ink-muted">Or:</span>
          <button type="button" onClick={openLinkedin} className="j4u-chip inline-flex items-center gap-2 h-9 px-3 rounded-md border border-hair text-ink-secondary text-xs font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.8-2.05 4.06 0 4.8 2.67 4.8 6.14V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" /></svg>
            Import from LinkedIn
          </button>
        </div>
      </Card>

      <Card>
        <div id="sec-basics" className="grid gap-4 sm:grid-cols-2 scroll-mt-20">
          <label className="block"><span className={LABEL}>Full name</span>
            <input className={FIELD} value={profile.fullName} onChange={(e) => set('fullName', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Headline / current title</span>
            <input className={FIELD} value={profile.headline} onChange={(e) => set('headline', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Email</span>
            <input className={FIELD} value={profile.email} onChange={(e) => set('email', e.target.value)} /></label>
          <label className="block"><span className={LABEL}>Phone</span>
            <input className={FIELD} value={profile.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={LABEL}>Location</span>
            <input className={FIELD} value={profile.location} onChange={(e) => set('location', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={LABEL}>Professional summary</span>
            <textarea className={FIELD} rows={3} value={profile.summary} onChange={(e) => set('summary', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={LABEL}>Skills (comma separated)</span>
            <input className={FIELD} value={profile.skills.join(', ')} onChange={(e) => set('skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></label>
        </div>
      </Card>

      <Card title="Experience" action={<button onClick={addExp} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-experience" className="space-y-4 scroll-mt-20">
          {profile.experience.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} aria-label="Job title" placeholder="Job title" value={x.title} onChange={(e) => updateExp(i, 'title', e.target.value)} />
              <input className={FIELD} aria-label="Company" placeholder="Company" value={x.company} onChange={(e) => updateExp(i, 'company', e.target.value)} />
              <input className={FIELD} aria-label="Start date" placeholder="Start (e.g. 2021)" value={x.startDate} onChange={(e) => updateExp(i, 'startDate', e.target.value)} />
              <input className={FIELD} aria-label="End date" placeholder="End (e.g. 2024 or Present)" value={x.endDate} onChange={(e) => updateExp(i, 'endDate', e.target.value)} />
              <textarea className={`${FIELD} sm:col-span-2`} rows={2} aria-label="What you did" placeholder="What you did" value={x.description} onChange={(e) => updateExp(i, 'description', e.target.value)} />
              <button onClick={() => removeExp(i)} className="text-sm font-medium text-danger-text justify-self-start j4u-focus rounded">Remove</button>
            </div>
          ))}
          {profile.experience.length === 0 && <p className="text-sm text-ink-muted">No experience added yet.</p>}
        </div>
      </Card>

      <Card title="Education" action={<button onClick={addEdu} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-education" className="space-y-4 scroll-mt-20">
          {profile.education.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} aria-label="Institution" placeholder="Institution" value={x.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} />
              <input className={FIELD} aria-label="Degree" placeholder="Degree" value={x.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} />
              <input className={FIELD} aria-label="Field of study" placeholder="Field" value={x.field} onChange={(e) => updateEdu(i, 'field', e.target.value)} />
              <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} />
              <button onClick={() => removeEdu(i)} className="text-sm font-medium text-danger-text justify-self-start j4u-focus rounded">Remove</button>
            </div>
          ))}
          {profile.education.length === 0 && <p className="text-sm text-ink-muted">No education added yet.</p>}
        </div>
      </Card>

      <Card title="Projects" action={<button onClick={() => listAdd('projects', { name: '', description: '', tech: [], url: '' })} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-projects" className="space-y-4 scroll-mt-20">
          {profile.projects.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} aria-label="Project name" placeholder="Project name" value={x.name} onChange={(e) => listUpd('projects', i, { name: e.target.value })} />
              <input className={FIELD} aria-label="Project link" placeholder="Link (optional)" value={x.url} onChange={(e) => listUpd('projects', i, { url: e.target.value })} />
              <textarea className={`${FIELD} sm:col-span-2`} rows={2} aria-label="Project description" placeholder="What it is and your impact" value={x.description} onChange={(e) => listUpd('projects', i, { description: e.target.value })} />
              <input className={`${FIELD} sm:col-span-2`} aria-label="Tech used" placeholder="Tech (comma separated, e.g. React, TypeScript)" value={x.tech.join(', ')} onChange={(e) => listUpd('projects', i, { tech: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              <button onClick={() => listDel('projects', i)} className="text-sm font-medium text-danger-text justify-self-start j4u-focus rounded">Remove</button>
            </div>
          ))}
          {profile.projects.length === 0 && <p className="text-sm text-ink-muted">No projects added yet.</p>}
        </div>
      </Card>

      <Card title="Certifications" action={<button onClick={() => listAdd('certifications', { name: '', issuer: '', year: '', url: '' })} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-certifications" className="space-y-4 scroll-mt-20">
          {profile.certifications.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} aria-label="Certification name" placeholder="Certification" value={x.name} onChange={(e) => listUpd('certifications', i, { name: e.target.value })} />
              <input className={FIELD} aria-label="Issuer" placeholder="Issuer (e.g. Coursera)" value={x.issuer} onChange={(e) => listUpd('certifications', i, { issuer: e.target.value })} />
              <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => listUpd('certifications', i, { year: e.target.value })} />
              <input className={FIELD} aria-label="Credential link" placeholder="Credential link (optional)" value={x.url} onChange={(e) => listUpd('certifications', i, { url: e.target.value })} />
              <button onClick={() => listDel('certifications', i)} className="text-sm font-medium text-danger-text justify-self-start j4u-focus rounded">Remove</button>
            </div>
          ))}
          {profile.certifications.length === 0 && <p className="text-sm text-ink-muted">No certifications added yet.</p>}
        </div>
      </Card>

      <Card title="Languages" action={<button onClick={() => listAdd('languages', { name: '', level: '' })} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-languages" className="grid gap-3 sm:grid-cols-2 scroll-mt-20">
          {profile.languages.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-3 flex items-center gap-2">
              <input className={FIELD} aria-label="Language" placeholder="Language" value={x.name} onChange={(e) => listUpd('languages', i, { name: e.target.value })} />
              <input className={FIELD} aria-label="Proficiency" placeholder="Level (e.g. Native, Fluent)" value={x.level} onChange={(e) => listUpd('languages', i, { level: e.target.value })} />
              <button onClick={() => listDel('languages', i)} aria-label="Remove language" className="text-danger-text shrink-0 j4u-focus rounded px-1">✕</button>
            </div>
          ))}
          {profile.languages.length === 0 && <p className="text-sm text-ink-muted sm:col-span-2">No languages added yet.</p>}
        </div>
      </Card>

      <Card title="Awards & honors" action={<button onClick={() => listAdd('awards', { title: '', issuer: '', year: '', description: '' })} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div id="sec-awards" className="space-y-4 scroll-mt-20">
          {profile.awards.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-md p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} aria-label="Award title" placeholder="Award (e.g. 1st place)" value={x.title} onChange={(e) => listUpd('awards', i, { title: e.target.value })} />
              <input className={FIELD} aria-label="Issuer or event" placeholder="Issuer / event" value={x.issuer} onChange={(e) => listUpd('awards', i, { issuer: e.target.value })} />
              <input className={FIELD} aria-label="Year" placeholder="Year" value={x.year} onChange={(e) => listUpd('awards', i, { year: e.target.value })} />
              <input className={FIELD} aria-label="Award description" placeholder="One line about it" value={x.description} onChange={(e) => listUpd('awards', i, { description: e.target.value })} />
              <button onClick={() => listDel('awards', i)} className="text-sm font-medium text-danger-text justify-self-start j4u-focus rounded">Remove</button>
            </div>
          ))}
          {profile.awards.length === 0 && <p className="text-sm text-ink-muted">No awards added yet.</p>}
        </div>
      </Card>
    </>
  );
}

/* ---------- Copilot rail ---------- */

function ProfileRail({ profile, onFix }: { profile: Profile; onFix: (s: ProfileSection) => void }) {
  const { score, suggestions } = useMemo(() => analyzeProfile(profile), [profile]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = suggestions.filter((s) => !dismissed.has(s.title));
  const label = score >= 85 ? 'Excellent — your profile is strong across the board.'
    : score >= 65 ? 'Strong — a few tweaks lift your match across all jobs.'
    : score >= 40 ? 'Getting there — fill the gaps below to stand out.'
    : 'Just started — add the basics so we can match you well.';

  return (
    <aside className="lg:sticky lg:top-[18px] bg-surface border border-ai-soft rounded-md overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3.5 j4u-grad-ai border-b border-ai-soft">
        <IconSparkle size={16} color="var(--ai-600)" />
        <span className="text-[13.5px] font-bold text-ink-strong">Profile copilot</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <RadialGauge value={score} size={56} stroke={6} color="var(--ai-600)">
            <span className="text-sm font-bold text-ink-strong">{score}%</span>
          </RadialGauge>
          <div>
            <div className="text-[13px] font-bold text-ink-strong">Profile strength</div>
            <div className="text-[11.5px] text-ink-secondary mt-0.5 leading-snug">{label}</div>
          </div>
        </div>

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
