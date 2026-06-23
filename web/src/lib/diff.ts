// Minimal line-level diff (LCS-based) for the Documents "what changed" view.
// Pure, dependency-free, deterministic.

export type DiffLineType = 'same' | 'add' | 'remove';
export interface DiffLine {
  type: DiffLineType;
  text: string;
}

function splitLines(s: string): string[] {
  return s.length ? s.split('\n') : [];
}

/**
 * Diff two blocks of text line-by-line.
 * Unchanged lines are `same`; lines only in `after` are `add`; lines only in
 * `before` are `remove`. A changed line shows as a `remove` then an `add`.
 * Output preserves reading order. On ties, removals are emitted before additions.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const m = a.length;
  const n = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (j < n && (i === m || lcs[i + 1][j] < lcs[i][j + 1])) {
      out.push({ type: 'add', text: b[j] });
      j++;
    } else {
      out.push({ type: 'remove', text: a[i] });
      i++;
    }
  }
  return out;
}
