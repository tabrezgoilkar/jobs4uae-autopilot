import { normalizeProfile } from '../schema.js';

// Maps a LinkedIn export — either a Voyager `profileView` payload (pulled by the
// bookmarklet from the logged-in tab) or a JSON Resume file — into our profile
// schema. Pure: no network, no AI, never invents data.

/** First non-empty `.elements` array among several possible Voyager view aliases. */
function elements(raw, ...aliases) {
  for (const key of aliases) {
    const view = raw?.[key];
    if (Array.isArray(view?.elements) && view.elements.length) return view.elements;
    if (Array.isArray(view) && view.length) return view; // some payloads inline the array
  }
  return [];
}

/** Voyager `{ month, year }` (or partial) → "YYYY-MM" / "YYYY" / "". */
function ym(date) {
  if (!date || !date.year) return '';
  return date.month ? `${date.year}-${String(date.month).padStart(2, '0')}` : String(date.year);
}

/** "NATIVE_OR_BILINGUAL" → "Native or bilingual". */
function humanizeProficiency(p) {
  if (!p || typeof p !== 'string') return '';
  const s = p.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function mapVoyager(raw) {
  const profile = raw.profile ?? {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  const experience = elements(raw, 'positionView', 'positionGroupView', 'positions').map((e) => ({
    company: str(e.companyName ?? e.company),
    title: str(e.title),
    startDate: ym(e.timePeriod?.startDate),
    endDate: e.timePeriod?.endDate ? ym(e.timePeriod.endDate) : 'Present',
    description: str(e.description),
  }));

  const education = elements(raw, 'educationView', 'educations').map((e) => ({
    institution: str(e.schoolName ?? e.school?.name),
    degree: str(e.degreeName),
    field: str(e.fieldOfStudy),
    year: ym(e.timePeriod?.endDate) || ym(e.timePeriod?.startDate),
  }));

  const skills = elements(raw, 'skillView', 'skills').map((e) => str(e.name)).filter(Boolean);

  const certifications = elements(raw, 'certificationView', 'certifications').map((e) => ({
    name: str(e.name),
    issuer: str(e.authority ?? e.issuer),
    year: ym(e.timePeriod?.startDate) || ym(e.timePeriod?.endDate),
    url: str(e.url),
  }));

  const languages = elements(raw, 'languageView', 'languages').map((e) => ({
    name: str(e.name),
    level: humanizeProficiency(e.proficiency) || str(e.level),
  }));

  const projects = elements(raw, 'projectView', 'projects').map((e) => ({
    name: str(e.title ?? e.name),
    description: str(e.description),
    tech: [],
    url: str(e.url),
  }));

  const awards = elements(raw, 'honorView', 'honors', 'awards').map((e) => ({
    title: str(e.title ?? e.name),
    issuer: str(e.issuer),
    year: ym(e.timePeriod?.startDate) || str(e.year),
    description: str(e.description),
  }));

  return normalizeProfile({
    fullName,
    headline: str(profile.headline),
    summary: str(profile.summary),
    location: str(profile.locationName ?? profile.geoLocationName),
    experience,
    education,
    skills,
    certifications,
    languages,
    projects,
    awards,
  });
}

function mapJsonResume(raw) {
  const b = raw.basics ?? {};
  const location = b.location
    ? [b.location.city, b.location.region, b.location.countryCode].filter(Boolean).join(', ')
    : '';

  return normalizeProfile({
    fullName: str(b.name),
    email: str(b.email),
    phone: str(b.phone),
    headline: str(b.label),
    summary: str(b.summary),
    location,
    experience: (raw.work ?? []).map((w) => ({
      company: str(w.name ?? w.company),
      title: str(w.position),
      startDate: str(w.startDate),
      endDate: str(w.endDate) || 'Present',
      description: str(w.summary),
    })),
    education: (raw.education ?? []).map((e) => ({
      institution: str(e.institution),
      degree: str(e.studyType),
      field: str(e.area),
      year: str(e.endDate),
    })),
    skills: (raw.skills ?? []).map((s) => str(s.name)).filter(Boolean),
    certifications: (raw.certificates ?? []).map((c) => ({
      name: str(c.name),
      issuer: str(c.issuer),
      year: str(c.date),
      url: str(c.url),
    })),
    languages: (raw.languages ?? []).map((l) => ({ name: str(l.language), level: str(l.fluency) })),
    projects: (raw.projects ?? []).map((p) => ({
      name: str(p.name),
      description: str(p.description),
      tech: Array.isArray(p.keywords) ? p.keywords : [],
      url: str(p.url),
    })),
    awards: (raw.awards ?? []).map((a) => ({
      title: str(a.title),
      issuer: str(a.awarder),
      year: str(a.date),
      description: str(a.summary),
    })),
    links: (b.profiles ?? []).map((p) => str(p.url)).filter(Boolean),
  });
}

function isJsonResume(raw) {
  return !!(raw && typeof raw === 'object' && (raw.basics || Array.isArray(raw.work)));
}

function isVoyager(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return !!(
    raw.profile ||
    raw.positionView ||
    raw.educationView ||
    raw.skillView ||
    raw.positions ||
    raw.educations
  );
}

/** True when `raw` is recognizable as a LinkedIn Voyager or JSON Resume export. */
export function looksLikeLinkedinExport(raw) {
  return isJsonResume(raw) || isVoyager(raw);
}

/** LinkedIn export (Voyager or JSON Resume) → normalized profile. */
export function linkedinToProfile(raw) {
  if (isJsonResume(raw)) return mapJsonResume(raw);
  return mapVoyager(raw ?? {});
}
