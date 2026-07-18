// Deterministic, client-side job matching: company blacklist + a 1-line
// "why it fits" reason derived purely from profile vs listing fields.
// No AI / network — mirrors server/evaluate/match.js for parity.

export interface Listing {
  url: string;
  title: string;
  company: string;
  location: string;
}

export interface MatchResult {
  blocked: boolean;
  reason: string; // human-readable 1-line reason the job fits the profile ('' when blocked)
}

export function isBlocked(company: string | undefined, blocked: string[] = []): boolean {
  const c = String(company ?? '').toLowerCase().trim();
  if (!c) return false;
  return (blocked || []).some((b) => {
    const needle = String(b ?? '').toLowerCase().trim();
    return needle.length > 0 && c.includes(needle);
  });
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim();
const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

export function matchJob(profile: { skills?: string[]; experience?: { title?: string }[]; headline?: string; location?: string }, listing: Listing): MatchResult {
  if (isBlocked(listing.company, (profile as { blockedCompanies?: string[] }).blockedCompanies)) {
    return { blocked: true, reason: '' };
  }

  const jobText = norm([listing.title, listing.company, listing.location].join(' '));
  const parts: string[] = [];

  // 1) Skills — profile skills appearing in the listing text.
  const skills = (profile.skills || []).map(norm).filter(Boolean);
  const matchedSkills = skills.filter((s) => jobText.includes(s));
  if (matchedSkills.length > 0) {
    parts.push(`${titleCase(matchedSkills[0])} skill`);
  }

  // 2) Title / headline match.
  const titleText = norm(listing.title);
  const headline = norm(profile.headline);
  const titleTerms: string[] = [];
  if (headline && titleText.includes(headline) && headline.length > 2) titleTerms.push(headline);
  for (const exp of profile.experience || []) {
    const t = norm(exp.title);
    if (t && t.length > 2 && titleText.includes(t)) {
      titleTerms.push(t);
      break;
    }
  }
  if (titleTerms.length > 0) parts.push(`your ${titleCase(titleTerms[0])} title`);

  // 3) Location / GCC market match.
  const profLoc = norm(profile.location);
  const jobLoc = norm(listing.location);
  let locMatch = '';
  if (profLoc && jobLoc) {
    if (jobLoc.includes(profLoc) || profLoc.includes(jobLoc)) locMatch = profLoc;
    else {
      const gcc = ['uae', 'dubai', 'abu dhabi', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'gulf'];
      const hit = gcc.find((g) => jobLoc.includes(g) && profLoc.includes(g));
      if (hit) locMatch = hit;
    }
  }
  if (locMatch) parts.push(`${titleCase(locMatch)} location`);

  if (parts.length === 0) {
    return { blocked: false, reason: 'New opportunity — not an obvious match to your profile yet.' };
  }
  return { blocked: false, reason: `Matches your ${parts.join(' + ')}` };
}

export function filterBlocked(listings: Listing[], blocked: string[]): { visible: Listing[]; blockedUrls: Set<string> } {
  const blockedUrls = new Set<string>();
  const visible: Listing[] = [];
  for (const l of listings) {
    if (isBlocked(l.company, blocked)) blockedUrls.add(l.url);
    else visible.push(l);
  }
  return { visible, blockedUrls };
}
