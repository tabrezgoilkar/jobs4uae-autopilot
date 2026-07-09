import { normalizeProfile } from '../schema.js';

// Maps the schema.org `Person` block LinkedIn embeds in a public profile page
// (<script type="application/ld+json">) into our profile schema. Pure: no
// network, no AI, never invents data. This is the "instant prefill" source —
// it carries the basics (name, headline, location, employers + years,
// education) but NOT skills, full role bullets or the long About; those come
// from the vision path. See fetchPublic.js for how the HTML is obtained.

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** A JSON-LD member date is a year number (1975) or a string; → "YYYY"/"" . */
function yearOf(d) {
  if (d == null) return '';
  if (typeof d === 'number') return String(d);
  return str(d);
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  return v == null ? [] : [v];
}

/** schema.org `Person` node → normalized profile. */
export function jsonLdToProfile(node = {}) {
  const headline = toArray(node.jobTitle).map(str).filter(Boolean).join(', ');

  const experience = toArray(node.worksFor).map((o) => ({
    company: str(o?.name),
    title: '', // JSON-LD doesn't pair a title to an employer — don't invent one
    startDate: yearOf(o?.member?.startDate),
    endDate: o?.member?.endDate != null ? yearOf(o.member.endDate) : 'Present',
    description: '',
  })).filter((e) => e.company);

  const education = toArray(node.alumniOf).map((o) => ({
    institution: str(o?.name),
    degree: '',
    field: '',
    year: yearOf(o?.member?.endDate) || yearOf(o?.member?.startDate),
  })).filter((e) => e.institution);

  const languages = toArray(node.knowsLanguage)
    .map((l) => ({ name: typeof l === 'string' ? str(l) : str(l?.name), level: '' }))
    .filter((l) => l.name);

  const links = [str(node.url) || str(node.sameAs)].filter(Boolean);

  return normalizeProfile({
    fullName: str(node.name),
    headline,
    summary: str(node.description),
    location: str(node.address?.addressLocality),
    experience,
    education,
    languages,
    links,
  });
}

/**
 * Recursively find the first schema.org `Person` node in a parsed JSON-LD value.
 * LinkedIn nests the Person node in different shapes across profiles:
 *   - top-level `{ "@type": "Person", ... }`
 *   - inside an `@graph` array: `{ "@graph": [ { "@type": "Person" }, ... ] }`
 *   - inside a wrapping node: `{ "@type": "ProfilePage", "author": { "@type": "Person" } }`
 * The original implementation only checked top-level / `@graph` and silently
 * returned null for the wrapping case — which `fetchPublic.js` then mis-reported
 * as `reason: 'blocked'` (so the UI wrongly told users to use screenshots).
 * Depth-capped to avoid runaway traversal of a malformed blob.
 */
function findPersonNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = findPersonNode(v, depth + 1);
      if (r) return r;
    }
    return null;
  }
  const t = node['@type'];
  if (t === 'Person' || (Array.isArray(t) && t.includes('Person'))) return node;
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === 'object') {
      const r = findPersonNode(val, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

/** Find and return the schema.org Person node in a page's ld+json, or null. */
export function extractJsonLd(html) {
  if (typeof html !== 'string') return null;
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const found = findPersonNode(data);
    if (found) return found;
  }
  return null;
}
