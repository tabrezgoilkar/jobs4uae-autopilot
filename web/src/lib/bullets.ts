// Deterministic bullet formatter — no AI, no network.
// Turns messy experience descriptions into clean "- " bullets:
//   - strips bullet prefixes (• * – — · ‣ etc.)
//   - collapses wrapped lines belonging to the same bullet
//   - trims & de-duplicates
// Returns the formatted text plus how many lines actually changed.

const BULLET_PREFIX = /^\s*(?:[-•‣◦⁃∙*·–—●○▪▸►]+[\s.)-]*|\d+[.)]\s+)/;
const WRAP_RE = /^[\s]*[a-z]/; // continuation line (lowercase start = wrapped)

export interface BulletFormatResult {
  text: string;
  bullets: string[];
  changed: number;   // number of source lines whose normalized form differs
  originalCount: number;
}

export function formatBullets(input: string): BulletFormatResult {
  const raw = (input ?? '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  // 1) merge wrapped continuation lines into the preceding bullet
  const merged: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (merged.length > 0 && WRAP_RE.test(t) && !BULLET_PREFIX.test(t)) {
      // continuation of previous bullet
      merged[merged.length - 1] += ' ' + t;
    } else {
      merged.push(t);
    }
  }

  // 2) strip prefixes, trim, build clean bullets
  const seen = new Set<string>();
  const bullets: string[] = [];
  let changed = 0;
  const originals = merged.filter(Boolean);

  for (const m of merged) {
    let body = m.replace(BULLET_PREFIX, '').trim();
    if (!body) continue;
    body = body.replace(/\s+/g, ' ').replace(/[.;,]+$/, '').trim();
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue; // de-dup
    seen.add(key);
    bullets.push(`- ${body}`);
    // count as "changed" if the original (pre-strip, post-merge) wasn't already a clean "- " bullet
    if (!m.startsWith('- ') && !m.startsWith('-')) changed++;
  }

  return { text: bullets.join('\n'), bullets, changed, originalCount: originals.length };
}
