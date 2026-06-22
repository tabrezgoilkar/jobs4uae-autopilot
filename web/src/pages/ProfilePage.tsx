import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  saveProfile,
  importCv,
  type Profile,
  type Experience,
  type Education,
} from '../api';
import { Card, PageHeader, Button } from '../components/ui';

const FIELD = 'mt-1 w-full rounded-lg border border-hair bg-surface text-ink p-2 text-sm j4u-focus placeholder:text-ink-muted';
const LABEL = 'text-sm font-medium text-ink-secondary';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setLoadError(true));
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const parsed = await importCv(file);
      setProfile(parsed);
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

  if (loadError) {
    return (
      <div role="alert" className="text-sm rounded-lg p-3 bg-danger-soft text-danger-text border border-danger-soft">
        Could not load your profile. Make sure the server is running, then refresh this page.
      </div>
    );
  }

  if (!profile) {
    return <div className="text-ink-muted text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Upload your CV to fill this in automatically, or type it yourself." />

      <Card>
        <label className="block">
          <span className={LABEL}>Import from a CV file (PDF, Word, or text)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={onFile}
            disabled={importing}
            className="mt-2 block text-sm text-ink-secondary"
          />
        </label>
        {importing && <p className="mt-2 text-sm text-primary-700">Reading your CV with AI… this can take a few seconds.</p>}
      </Card>

      {message && (
        <div role="status" className={`text-sm rounded-lg p-3 border ${message.ok ? 'bg-success-soft text-success-text border-success-soft' : 'bg-danger-soft text-danger-text border-danger-soft'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <input
              className={FIELD}
              value={profile.skills.join(', ')}
              onChange={(e) => set('skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            /></label>
        </div>
      </Card>

      <Card title="Experience" action={<button onClick={addExp} className="text-sm font-semibold text-primary-700 j4u-focus rounded">+ Add</button>}>
        <div className="space-y-4">
          {/* Index keys are acceptable here: inputs are controlled and the lists are short. */}
          {profile.experience.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-xl p-4 grid gap-3 sm:grid-cols-2">
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
        <div className="space-y-4">
          {profile.education.map((x, i) => (
            <div key={i} className="border border-hair-subtle rounded-xl p-4 grid gap-3 sm:grid-cols-2">
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

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving || importing}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
        {profile.updatedAt && <span className="text-xs text-ink-muted">Last saved {new Date(profile.updatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}
