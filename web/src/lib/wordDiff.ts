// Word-level + section-aware diff for the Documents "what changed" view —
// a Word-style amendment review (inline insertions/deletions grouped by section),
// not a crude line file-diff.

export type ChangeType = 'same' | 'add' | 'remove';
export interface ChangeSegment {
  type: ChangeType;
  text: string;
}
export interface DiffedSection {
  heading: string;
  segments: ChangeSegment[];
  changed: boolean;
}

function tokenize(s: string): string[] {
  return s.length ? (s.match(/\s+|[^\s]+/g) ?? []) : [];
}

/** Word/token-level LCS diff. Consecutive same-type tokens are merged into runs. */
export function diffWords(before: string, after: string): ChangeSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const raw: ChangeSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { raw.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (j < n && (i === m || lcs[i + 1][j] < lcs[i][j + 1])) { raw.push({ type: 'add', text: b[j] }); j++; }
    else { raw.push({ type: 'remove', text: a[i] }); i++; }
  }
  const merged: ChangeSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}

interface RawSection { heading: string; body: string; }

function splitSections(md: string): RawSection[] {
  const lines = (md ?? '').split('\n');
  const out: RawSection[] = [];
  let cur: { heading: string; lines: string[] } = { heading: '', lines: [] };
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      out.push({ heading: cur.heading, body: cur.lines.join('\n').trim() });
      cur = { heading: line.replace(/^#{1,6}\s*/, '').trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  out.push({ heading: cur.heading, body: cur.lines.join('\n').trim() });
  return out;
}

/**
 * Pair markdown sections by heading and word-diff each. Returns sections in the
 * tailored ("after") order, then any sections that were removed entirely.
 */
export function diffSections(before: string, after: string): DiffedSection[] {
  const a = splitSections(before);
  const b = splitSections(after);
  const aByKey = new Map(a.map((s) => [s.heading.toLowerCase(), s]));
  const seen = new Set<string>();
  const out: DiffedSection[] = [];

  for (const sec of b) {
    const key = sec.heading.toLowerCase();
    seen.add(key);
    const prev = aByKey.get(key);
    const segments = diffWords(prev?.body ?? '', sec.body);
    out.push({ heading: sec.heading, segments, changed: !prev || segments.some((s) => s.type !== 'same') });
  }
  for (const sec of a) {
    if (!seen.has(sec.heading.toLowerCase())) {
      out.push({ heading: sec.heading, segments: diffWords(sec.body, ''), changed: true });
    }
  }
  return out;
}
