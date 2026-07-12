import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listEvaluations,
  listDocuments,
  getProfile,
  type AppConfig,
  type Evaluation,
  type DocumentRecord,
} from '../api';
import { listApplications, type Application, type ApplicationStatus } from '../features/tracker/trackerApi';
import { learningLinks } from '../lib/skills';
import { Badge, GradeBadge, type Tone } from '../components/ui';
import { IconSparkle } from '../components/icons';
import { Donut, RadialGauge, Sparkline, type Segment } from '../components/charts';
import { useCountUp } from '../components/charts/useCountUp';

const GRADE_SCORE: Record<string, number> = { A: 92, B: 82, C: 68, D: 52, F: 35 };
const REC: Record<Evaluation['recommendation'], { label: string; tone: Tone }> = {
  apply: { label: 'Apply', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  skip: { label: 'Skip', tone: 'danger' },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: color }} />
      <span className="flex-1 text-[13px] text-ink-secondary">{label}</span>
      <span className="text-[15px] font-bold text-ink-strong tabular-nums">{value}</span>
    </div>
  );
}

export default function Dashboard({ config }: { config: AppConfig }) {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    listEvaluations().then(setEvals).catch(() => {});
    listApplications().then(setApps).catch(() => {});
    listDocuments().then(setDocs).catch(() => {});
    getProfile().then((p) => setName((p.fullName || '').split(' ')[0] || '')).catch(() => {});
  }, []);

  const count = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
  const avgFit = useMemo(() => {
    if (!evals.length) return null;
    const total = evals.reduce((sum, e) => sum + (GRADE_SCORE[(e.grade || '').toUpperCase()] ?? 60), 0);
    return Math.round(total / evals.length);
  }, [evals]);

  const recent = useMemo(
    () => [...evals].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3),
    [evals],
  );
  const topEval = useMemo(
    () => [...evals].sort((a, b) => (GRADE_SCORE[b.grade?.toUpperCase()] ?? 0) - (GRADE_SCORE[a.grade?.toUpperCase()] ?? 0))[0],
    [evals],
  );
  const waiting = apps.find((a) => a.status === 'interview') ?? apps.find((a) => a.status === 'applied');
  const inProgress = count('applied') + count('interview') + count('offer');

  const fitTrend = useMemo(
    () => [...evals]
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .map((e) => GRADE_SCORE[(e.grade || '').toUpperCase()] ?? 60),
    [evals],
  );

  const saved = count('saved'), applied = count('applied'), interview = count('interview'), offer = count('offer');
  const pipelineTotal = saved + applied + interview + offer;
  const animTotal = useCountUp(pipelineTotal);
  const animFit = useCountUp(avgFit ?? 0);
  const segs: Segment[] = [
    { value: saved, color: 'var(--text-muted)', label: 'Saved' },
    { value: applied, color: 'var(--primary-600)', label: 'Applied' },
    { value: interview, color: 'var(--ai-600)', label: 'Interview' },
    { value: offer, color: 'var(--success)', label: 'Offer' },
  ];

  const skillGaps = useMemo(() => {
    const freq = new Map<string, number>();
    for (const e of evals) for (const s of e.missingSkills ?? []) {
      const k = s.trim();
      if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [evals]);

  const activity = useMemo(() => {
    const items: { at: string; text: string; src: string }[] = [];
    for (const e of evals) items.push({ at: e.createdAt, text: `Evaluated ${e.jobTitle || 'a job'} — grade ${e.grade}`, src: 'evaluate' });
    for (const d of docs) items.push({ at: d.updatedAt || d.createdAt, text: `Tailored documents for ${d.jobTitle || 'a job'}`, src: 'documents' });
    for (const a of apps) items.push({ at: a.updatedAt || a.createdAt, text: `${a.jobTitle || 'A job'} — ${a.status} in tracker`, src: 'tracker' });
    return items.filter((i) => i.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  }, [evals, docs, apps]);

  const reviewCount = recent.length;

  return (
    <div className="space-y-[18px] j4u-rise">
      {/* greeting */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-ink-strong">{greeting()}{name ? `, ${name}` : ''} 👋</div>
          <div className="text-sm text-ink-secondary mt-1">
            You have <b className="text-ink">{reviewCount} job{reviewCount !== 1 ? 's' : ''} to review</b>
            {' '}and <b className="text-ink">{inProgress} application{inProgress !== 1 ? 's' : ''} in progress</b>.
          </div>
        </div>
        <Link to="/scan" className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-md bg-primary-600 text-white text-sm font-semibold j4u-press">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Scan &amp; evaluate jobs
        </Link>
      </div>

      {/* briefing */}
      <div className="j4u-grad-brief rounded-md px-5 py-4 flex items-start gap-3">
        <span className="w-9 h-9 flex-none rounded-md bg-surface flex items-center justify-center"><IconSparkle size={17} color="var(--ai-600)" /></span>
        <div className="flex-1">
          <div className="text-[11px] font-bold tracking-wider uppercase text-ai-700 font-mono">Your briefing</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink">
            {evals.length === 0
              ? <>Start by evaluating a job or scanning a board — I'll give each role an honest A–F fit score and show you exactly where you stand.</>
              : <>You've evaluated <b>{evals.length} job{evals.length !== 1 ? 's' : ''}</b>{avgFit !== null && <> with an average fit of <b>{avgFit}%</b></>}{topEval && <>. Your strongest match is <b>{topEval.jobTitle || 'a role'}</b> ({topEval.grade})</>}{inProgress > 0 && <>, and you have <b>{inProgress}</b> application{inProgress !== 1 ? 's' : ''} in progress</>}.</>}
          </p>
          <div className="flex gap-2 mt-3">
            <Link to="/scan" className="h-[34px] px-3.5 inline-flex items-center rounded-md bg-ai-600 text-white text-[12.5px] font-semibold j4u-press">Scan more jobs →</Link>
            {topEval && <Link to={`/evaluate?eval=${topEval.id}`} className="h-[34px] px-3.5 inline-flex items-center rounded-md bg-surface border border-ai-soft text-ai-700 text-[12.5px] font-semibold j4u-press">Tailor your top match</Link>}
          </div>
        </div>
      </div>

      {/* pipeline + fit visualisation */}
      <div className="grid lg:grid-cols-2 gap-[18px]">
        <div className="bg-surface border border-hair-subtle rounded-md p-5">
          <div className="text-sm font-bold text-ink-strong mb-4">Your pipeline</div>
          <div className="flex items-center gap-6">
            <Donut segments={segs}>
              <div className="text-[26px] font-bold text-ink-strong tabular-nums leading-none">{animTotal}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">in pipeline</div>
            </Donut>
            <div className="flex-1 space-y-2.5 min-w-0">
              <LegendRow color="var(--text-muted)" label="Saved" value={saved} />
              <LegendRow color="var(--primary-600)" label="Applied" value={applied} />
              <LegendRow color="var(--ai-600)" label="Interview" value={interview} />
              <LegendRow color="var(--success)" label="Offer" value={offer} />
            </div>
          </div>
        </div>
        <div className="bg-surface border border-hair-subtle rounded-md p-5">
          <div className="text-sm font-bold text-ink-strong mb-4">Average fit</div>
          <div className="flex items-center gap-6">
            <RadialGauge value={avgFit ?? 0} color="var(--ai-600)">
              <div className="text-[22px] font-bold text-ink-strong tabular-nums leading-none">{avgFit === null ? '—' : `${animFit}%`}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">avg fit</div>
            </RadialGauge>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-muted mb-1">Fit trend · {fitTrend.length} eval{fitTrend.length !== 1 ? 's' : ''}</div>
              {fitTrend.length >= 2 ? (
                <>
                  <Sparkline data={fitTrend} color="var(--ai-600)" fill="var(--ai-soft)" id="fit" width={210} />
                  {(() => {
                    const d = fitTrend[fitTrend.length - 1] - fitTrend[0];
                    return <div className={`text-xs font-semibold mt-1 ${d >= 0 ? 'text-success-text' : 'text-danger-text'}`}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)} pts vs first</div>;
                  })()}
                </>
              ) : (
                <p className="text-xs text-ink-muted">Evaluate more jobs to see your fit trend.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* review + side column */}
      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-[18px]">
        {/* ready to review */}
        <div className="bg-surface border border-hair-subtle rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[15px] border-b border-hair-subtle">
            <div className="text-sm font-bold text-ink-strong">Ready for you to review</div>
            <Link to="/scan" className="text-xs font-semibold text-primary-700">Scan more →</Link>
          </div>
          {recent.length === 0 && (
            <div className="px-[18px] py-8 text-center text-sm text-ink-muted">
              No evaluated jobs yet. <Link to="/scan" className="text-primary-700 font-semibold">Scan a board</Link> or <Link to="/evaluate" className="text-primary-700 font-semibold">paste a job</Link> to begin.
            </div>
          )}
          {recent.map((e, i) => {
            const rec = REC[e.recommendation] ?? { label: e.recommendation, tone: 'neutral' as Tone };
            return (
              <Link
                key={e.id}
                to={`/evaluate?eval=${e.id}`}
                className={`j4u-nav flex items-center gap-3.5 px-[18px] py-3.5 ${i < recent.length - 1 ? 'border-b border-hair-subtle' : ''}`}
              >
                <GradeBadge grade={e.grade} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink-strong truncate">{e.jobTitle || 'Evaluated job'}</div>
                  <div className="text-xs text-ink-muted truncate">{[e.company, e.location].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <Badge tone={rec.tone}>{rec.label}</Badge>
              </Link>
            );
          })}
        </div>

        {/* side column */}
        <div className="flex flex-col gap-3.5">
          {/* copilot tip */}
          <div className="j4u-grad-ai rounded-md p-[17px]">
            <div className="flex items-center gap-2"><IconSparkle size={15} color="var(--ai-600)" /><span className="text-[13px] font-bold text-ink-strong">Copilot tip</span></div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink">
              {topEval
                ? <>Your <b>{topEval.jobTitle || 'top'}</b> role scored an <b>{topEval.grade}</b>. Want me to tailor your CV and draft a cover letter for it?</>
                : <>Evaluate a job and I'll suggest exactly how to tailor your CV to match it.</>}
            </p>
            <Link to={topEval ? `/evaluate?eval=${topEval.id}` : '/evaluate'} className="mt-3 inline-flex h-[34px] px-3.5 items-center rounded-md bg-ai-600 text-white text-[12.5px] font-semibold j4u-press">Tailor it →</Link>
          </div>

          {/* waiting on you */}
          <div className="bg-surface border border-hair-subtle rounded-md p-[17px]">
            <div className="text-[13px] font-bold text-ink-strong mb-2.5">Waiting on you</div>
            {waiting ? (
              <div className="flex items-center gap-2.5">
                <span className="w-[34px] h-[34px] flex-none rounded-md bg-warning-soft flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink-strong truncate">{waiting.jobTitle || 'Application'}{waiting.company ? ` · ${waiting.company}` : ''}</div>
                  <div className="text-[11.5px] text-ink-muted">{waiting.status === 'interview' ? 'Interview stage — prep below' : 'Applied — awaiting reply'}</div>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-muted">Nothing waiting on you right now. Apply to a role and it'll show up here.</p>
            )}
          </div>
        </div>
      </div>

      {/* insights: learning + interview prep */}
      <div className="grid lg:grid-cols-[1.45fr_1fr] gap-[18px] items-start">
        {/* learning */}
        <div className="bg-surface border border-hair-subtle rounded-md p-[18px]">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-ink-strong">Level up to match more jobs</div>
            <Badge tone="ai"><IconSparkle size={9} color="var(--ai-600)" />AI</Badge>
          </div>
          <div className="text-[12.5px] text-ink-muted mt-1">
            These skills show up most in the jobs you're <b className="text-ink-secondary">just missing</b> — every course below is free.
          </div>
          {skillGaps.length === 0 && (
            <p className="mt-3 text-sm text-ink-muted">No skill gaps yet — evaluate a few jobs and I'll surface the skills worth learning.</p>
          )}
          {skillGaps.map(([skill, n]) => (
            <div key={skill} className="border-t border-hair-subtle pt-3.5 mt-3">
              <div className="flex items-center gap-2.5">
                <span className="w-[34px] h-[34px] flex-none rounded-md bg-primary-50 flex items-center justify-center">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink-strong">{skill}</div>
                  <div className="text-[11.5px] text-ink-muted">Appears in <b className="text-ink-secondary">{n}</b> of your evaluated job{n !== 1 ? 's' : ''}</div>
                </div>
                <Badge tone="success">+{Math.min(8, 3 + n)} pts fit</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5 pl-[45px]">
                {learningLinks(skill).slice(0, 3).map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 rounded-pill px-2.5 py-[3px] j4u-press">{l.label} ↗</a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* interview prep */}
        <div className="j4u-grad-ai rounded-md px-5 py-[18px] flex flex-col">
          <div className="flex items-center gap-2"><IconSparkle size={15} color="var(--ai-600)" /><span className="text-sm font-bold text-ink-strong">Interview prep</span></div>
          <div className="text-xs text-ink-secondary mt-1.5">
            {waiting ? <>{waiting.jobTitle || 'Your next role'}{waiting.company ? ` · ${waiting.company}` : ''}</> : <>Practice for your next interview</>}
          </div>
          <div className="text-[11px] font-bold tracking-wide uppercase text-ai-700 my-3">Likely questions</div>
          <div className="flex flex-col gap-2">
            {[
              `Walk me through a project you're most proud of${topEval?.jobTitle ? ` relevant to ${topEval.jobTitle}.` : '.'}`,
              'Tell me about a time you handled a difficult problem under pressure.',
              'Why do you want this role, and why now?',
            ].map((q, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-surface border border-ai-soft rounded-md px-3 py-2.5">
                <span className="font-mono text-[10px] font-bold text-ai-700 mt-0.5">Q{i + 1}</span>
                <span className="flex-1 text-[12.5px] text-ink leading-snug">{q}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            title="Mock interview — coming soon"
            className="mt-3.5 w-full inline-flex items-center justify-center gap-2 h-[42px] rounded-md bg-ai-600 text-white text-[13px] font-semibold j4u-press opacity-70 cursor-default"
            disabled
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" /></svg>
            Start a mock interview
          </button>
        </div>
      </div>

      {/* recent activity */}
      <div className="bg-surface border border-hair-subtle rounded-md px-5 py-[18px]">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="text-sm font-bold text-ink-strong">Recent activity</div>
          <span className="text-xs text-ink-muted">— everything the copilot does is logged</span>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">No activity yet. Your evaluations, documents and tracker changes will appear here.</p>
        ) : (
          <div className="flex flex-col">
            {activity.map((a, i) => (
              <div key={i} className="flex gap-3 pb-3.5">
                <div className="flex flex-col items-center">
                  <span className="w-[26px] h-[26px] flex-none rounded-full bg-ai-soft border border-ai-soft flex items-center justify-center"><IconSparkle size={12} color="var(--ai-600)" /></span>
                  {i < activity.length - 1 && <span className="flex-1 w-px bg-hair-subtle mt-1" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="text-[13px] text-ink">{a.text}</div>
                  <div className="text-[11.5px] text-ink-muted mt-0.5 font-mono">{timeAgo(a.at)} · {a.src}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted text-center">AI is connected using <span className="font-semibold text-ink-secondary">{config.engine ?? 'unknown'}</span>.</p>
    </div>
  );
}
