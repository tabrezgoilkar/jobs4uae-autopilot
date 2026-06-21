import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  saveProfile,
  importCv,
  type Profile,
  type Experience,
  type Education,
} from '../api';

const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm';
const LABEL = 'text-sm font-medium text-slate-700';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setMessage({ ok: false, text: 'Could not load your profile.' }));
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

  if (!profile) {
    return <div className="text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="mt-1 text-slate-600">Upload your CV to fill this in automatically, or type it yourself.</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <label className={LABEL}>Import from a CV file (PDF, Word, or text)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={onFile}
          disabled={importing}
          className="mt-2 block text-sm"
        />
        {importing && <p className="mt-2 text-sm text-blue-600">Reading your CV with AI… this can take a few seconds.</p>}
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 grid gap-4 sm:grid-cols-2">
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

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Experience</h2>
          <button onClick={addExp} className="text-sm text-blue-600">+ Add</button>
        </div>
        <div className="mt-4 space-y-4">
          {profile.experience.map((x, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Job title" value={x.title} onChange={(e) => updateExp(i, 'title', e.target.value)} />
              <input className={FIELD} placeholder="Company" value={x.company} onChange={(e) => updateExp(i, 'company', e.target.value)} />
              <input className={FIELD} placeholder="Start (e.g. 2021)" value={x.startDate} onChange={(e) => updateExp(i, 'startDate', e.target.value)} />
              <input className={FIELD} placeholder="End (e.g. 2024 or Present)" value={x.endDate} onChange={(e) => updateExp(i, 'endDate', e.target.value)} />
              <textarea className={`${FIELD} sm:col-span-2`} rows={2} placeholder="What you did" value={x.description} onChange={(e) => updateExp(i, 'description', e.target.value)} />
              <button onClick={() => removeExp(i)} className="text-sm text-red-600 justify-self-start">Remove</button>
            </div>
          ))}
          {profile.experience.length === 0 && <p className="text-sm text-slate-400">No experience added yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Education</h2>
          <button onClick={addEdu} className="text-sm text-blue-600">+ Add</button>
        </div>
        <div className="mt-4 space-y-4">
          {profile.education.map((x, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Institution" value={x.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} />
              <input className={FIELD} placeholder="Degree" value={x.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} />
              <input className={FIELD} placeholder="Field" value={x.field} onChange={(e) => updateEdu(i, 'field', e.target.value)} />
              <input className={FIELD} placeholder="Year" value={x.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} />
              <button onClick={() => removeEdu(i)} className="text-sm text-red-600 justify-self-start">Remove</button>
            </div>
          ))}
          {profile.education.length === 0 && <p className="text-sm text-slate-400">No education added yet.</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {profile.updatedAt && <span className="text-xs text-slate-400">Last saved {new Date(profile.updatedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}
