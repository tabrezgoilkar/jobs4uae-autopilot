import { useEffect, useMemo, useState } from 'react';
import { getProfile, listEvaluations, listDocuments, type Profile, type Evaluation, type DocumentRecord } from '../api';
import { listApplications, type Application } from '../features/tracker/trackerApi';
import { analyzeProfile } from '../lib/profileStrength';
import type { MobileRoute } from './MobileApp';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
function gradeValue(g?: string) { return ({ A: 95, B: 82, C: 68, D: 50, F: 30 } as Record<string, number>)[g ?? ''] ?? 0; }
const GRADE_BG: Record<string, { bg: string; bd: string; fg: string }> = {
  A: { bg: 'var(--success-soft)', bd: '#BCE6CA', fg: 'var(--success-text)' },
  B: { bg: 'var(--primary-50)', bd: '#C5D6FB', fg: 'var(--primary-700)' },
  C: { bg: '#FCEFD6', bd: '#F3D9A8', fg: '#92560A' },
};

export default function MobileHome({ go }: { go: (r: MobileRoute) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
    listEvaluations().then(setEvals).catch(() => {});
    listApplications().then(setApps).catch(() => {});
    listDocuments().then(setDocs).catch(() => {});
  }, []);

  const firstName = (profile?.fullName || '').trim().split(' ')[0] || '';
  const strength = useMemo(() => (profile ? analyzeProfile(profile).score : 0), [profile]);
  const counts = useMemo(() => {
    const by = (s: string) => apps.filter((a) => a.status === s).length;
    const avg = evals.length ? Math.round(evals.reduce((n, e) => n + gradeValue(e.grade), 0) / evals.length) : 0;
    return { saved: by('saved'), applied: by('applied'), interview: by('interview'), offer: by('offer'), avg };
  }, [apps, evals]);
  const toReview = evals.slice(0, 3);

  const card = 'rounded-2xl p-4' as const;
  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border-subtle)' };

  return (
    <div className="j4u-rise space-y-4">
      <div>
        <div className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text-strong)' }}>{greeting()}{firstName ? `, ${firstName}` : ''} 👋</div>
        <div className="text-[13.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {profile?.fullName ? <>Your profile is <b style={{ color: 'var(--text)' }}>{strength}% complete</b>. Let's make it land more interviews.</> : <>Let's set up your profile to start matching GCC jobs.</>}
        </div>
      </div>

      {/* AI briefing — honest, profile-driven */}
      <div style={{ borderRadius: 16, padding: 16, background: 'linear-gradient(135deg,#EFF4FF,#F4EEFE)', border: '1px solid #E0D5FB' }}>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: '#fff' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="#6B45F0"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg></span>
          <span className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: '0.05em', color: 'var(--ai-700)', fontFamily: 'var(--font-mono)' }}>Copilot briefing</span>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text)' }}>
          {strength >= 80 ? 'Your profile is strong. Paste a job description in Documents and I\'ll tailor your CV + cover letter for it.'
            : 'Polish your profile and I\'ll boost your match across roles — import your CV or let the assistant improve it in plain words.'}
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => go('profile')} className="j4u-press flex-1 h-[38px] rounded-[10px] text-[12.5px] font-semibold text-white" style={{ background: 'var(--ai-600)', border: 'none' }}>Improve my profile →</button>
          <button onClick={() => go('evaluate')} className="j4u-press h-[38px] px-3.5 rounded-[10px] text-[12.5px] font-semibold" style={{ background: '#fff', border: '1px solid #E0D5FB', color: 'var(--ai-700)' }}>Tailor a CV</button>
        </div>
      </div>

      {/* stats */}
      <div className="flex gap-2.5 overflow-x-auto pb-0.5">
        {[{ n: counts.saved, l: 'Saved', c: 'var(--text-strong)' }, { n: counts.applied, l: 'Applied', c: 'var(--primary-700)' }, { n: counts.interview, l: 'Interview', c: 'var(--ai-700)' }, { n: counts.offer, l: 'Offer', c: 'var(--success-text)' }, { n: counts.avg ? `${counts.avg}%` : '—', l: 'Avg fit', c: 'var(--text-muted)' }].map((s) => (
          <div key={s.l} className="flex-none" style={{ width: 96, borderRadius: 13, padding: '13px 14px', ...cardStyle }}>
            <div className="text-[26px] font-bold tabular-nums" style={{ color: s.c }}>{s.n}</div>
            <div className="text-[11.5px] mt-px" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* to review */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[13.5px] font-bold" style={{ color: 'var(--text-strong)' }}>Ready to review</div>
          <span onClick={() => go('evaluate')} className="text-[12px] font-semibold" style={{ color: 'var(--primary-700)' }}>Documents →</span>
        </div>
        {toReview.length === 0 ? (
          <div className="px-4 py-5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>No evaluated jobs yet. Tailor a CV from a job description in Documents to see fit scores here.</div>
        ) : toReview.map((e, i) => {
          const g = GRADE_BG[e.grade] ?? GRADE_BG.C;
          return (
            <div key={i} className="j4u-tap flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < toReview.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 11, background: g.bg, border: `1px solid ${g.bd}` }}><div className="text-[18px] font-bold" style={{ color: g.fg }}>{e.grade}</div></div>
              <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-strong)' }}>{e.jobTitle || 'Job'}</div><div className="text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>{[e.company, e.location].filter(Boolean).join(' · ')}</div></div>
            </div>
          );
        })}
      </div>

      {/* recent docs / activity */}
      {docs.length > 0 && (
        <div className={card} style={cardStyle}>
          <div className="text-[13px] font-bold mb-2.5" style={{ color: 'var(--text-strong)' }}>Recent documents</div>
          {docs.slice(0, 3).map((d, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5"><span className="flex-none" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ai-500)' }} /><div className="text-[12.5px] truncate" style={{ color: 'var(--text)' }}>{d.jobTitle || 'Tailored CV'}{d.company ? ` · ${d.company}` : ''}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}
