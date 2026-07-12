import type { Profile } from '../api';

type ChangeKind = 'added' | 'changed' | 'removed' | 'none';

interface FieldRow { label: string; before: string; after: string; kind: ChangeKind; }

function diffScalars(prop: Profile, next: Profile, keys: string[]) {
  const rows: FieldRow[] = [];
  for (const k of keys) {
    const before = (prop as any)[k] ?? '';
    const after = (next as any)[k] ?? '';
    rows.push({ label: k, before, after, kind: before === after ? 'none' : after ? (before ? 'changed' : 'added') : 'removed' });
  }
  return rows.filter((r) => r.kind !== 'none');
}

function diffSimpleList(curLabel: string, before: string[], after: string[]) {
  const b = new Set(before.map((x) => x.toLowerCase()));
  const a = new Set(after.map((x) => x.toLowerCase()));
  const added = after.filter((x) => !b.has(x.toLowerCase()));
  const removed = before.filter((x) => !a.has(x.toLowerCase()));
  const rows: FieldRow[] = [];
  for (const x of added) rows.push({ label: curLabel, before: '', after: x, kind: 'added' });
  for (const x of removed) rows.push({ label: curLabel, before: x, after: '', kind: 'removed' });
  return rows;
}

function itemSummary(kindLabel: string, item: any): string {
  if (kindLabel === 'experience') return `${item.title || 'Role'} · ${item.company || ''}`;
  if (kindLabel === 'education') return `${item.degree || ''} ${item.field || ''} · ${item.institution || ''}`.trim();
  if (kindLabel === 'projects') return item.name || 'Project';
  if (kindLabel === 'certifications') return `${item.name || 'Cert'} · ${item.issuer || ''}`.trim();
  if (kindLabel === 'languages') return item.name || 'Language';
  if (kindLabel === 'awards') return item.title || 'Award';
  return JSON.stringify(item).slice(0, 80);
}

function diffItems(kindLabel: string, before: any[], after: any[]): FieldRow[] {
  const key = (it: any) => (it.name || it.title || it.institution || JSON.stringify(it)).toLowerCase();
  const bMap = new Map(before.map((it) => [key(it), it]));
  const aMap = new Map(after.map((it) => [key(it), it]));
  const rows: FieldRow[] = [];
  for (const it of after) {
    const k = key(it);
    if (!bMap.has(k)) rows.push({ label: kindLabel, before: '', after: itemSummary(kindLabel, it), kind: 'added' });
    else {
      const b = bMap.get(k)!;
      const anyChange = (Object.keys(it) as string[]).some((f) => String((it as any)[f] ?? '') !== String((b as any)[f] ?? ''));
      if (anyChange) rows.push({ label: kindLabel, before: itemSummary(kindLabel, b), after: itemSummary(kindLabel, it), kind: 'changed' });
    }
  }
  for (const it of before) {
    const k = key(it);
    if (!aMap.has(k)) rows.push({ label: kindLabel, before: itemSummary(kindLabel, it), after: '', kind: 'removed' });
  }
  return rows;
}

export function buildDiff(current: Profile, proposed: Profile): FieldRow[] {
  const rows: FieldRow[] = [];
  rows.push(...diffScalars(current, proposed, ['fullName', 'headline', 'email', 'phone', 'location', 'summary']));
  rows.push(...diffSimpleList('skills', current.skills ?? [], proposed.skills ?? []));
  rows.push(...diffSimpleList('links', current.links ?? [], proposed.links ?? []));
  rows.push(...diffItems('experience', current.experience ?? [], proposed.experience ?? []));
  rows.push(...diffItems('education', current.education ?? [], proposed.education ?? []));
  rows.push(...diffItems('projects', current.projects ?? [], proposed.projects ?? []));
  rows.push(...diffItems('certifications', current.certifications ?? [], proposed.certifications ?? []));
  rows.push(...diffItems('languages', current.languages ?? [], proposed.languages ?? []));
  rows.push(...diffItems('awards', current.awards ?? [], proposed.awards ?? []));
  return rows;
}

export default function ProfileDiff({ current, proposed }: { current: Profile; proposed: Profile }) {
  const rows = buildDiff(current, proposed);
  if (rows.length === 0) {
    return <div className="mt-2 text-[12px] text-ink-muted">No changes detected between current and proposed profile.</div>;
  }
  const counts = rows.reduce((a, r) => { a[r.kind] = (a[r.kind] || 0) + 1; return a; }, {} as Record<string, number>);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Preview of changes</span>
        <span className="text-[10.5px] text-ink-muted">
          {counts.added ? <span className="text-success-text mr-2">+{counts.added} added</span> : null}
          {counts.changed ? <span className="text-ai-700 mr-2">~{counts.changed} changed</span> : null}
          {counts.removed ? <span className="text-danger-text">−{counts.removed} removed</span> : null}
        </span>
      </div>
      <div className="rounded-md border border-hair bg-surface-sunken overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className="px-2.5 py-1.5 border-b border-hair last:border-b-0 text-[12px] flex gap-2 items-start">
            <span className="shrink-0 w-[78px] text-[10.5px] font-semibold text-ink-muted pt-0.5">{r.label}</span>
            <div className="flex-1 min-w-0">
              {r.kind === 'added' && <div className="text-success-text"><span className="opacity-60">+</span> {r.after}</div>}
              {r.kind === 'removed' && <div className="text-danger-text line-through decoration-danger-text/60"><span className="opacity-60 no-underline">−</span> {r.before}</div>}
              {r.kind === 'changed' && (
                <>
                  <div className="text-danger-text line-through decoration-danger-text/50">{r.before}</div>
                  <div className="text-success-text"><span className="opacity-60">→</span> {r.after}</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
