// Turn a stored profile into structured CV sections, consumed by the dependency-
// free PDF (.pdf) and Word (.docx) writers. This is the single source of truth
// for what the exported CV contains — independent of the on-screen templates.

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const dateRange = (s, e) => {
  const a = clean(s);
  const b = clean(e);
  if (a && b) return `${a} – ${b}`;
  return a || b || '';
};
function splitBullets(text) {
  return String(text || '')
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•‣◦⁃∙\-*]+\s*/, '').trim())
    .filter(Boolean);
}

/**
 * @param {object} profile
 * @returns {{ name:string, headline:string, contact:string, sections: Array<{title:string, items:Array<{heading?:string, sub?:string, body?:string, bullets?:string[]}>}> }}
 */
export function profileToCvSections(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const contact = [clean(p.email), clean(p.phone), clean(p.location)]
    .filter(Boolean)
    .join('  ·  ');

  const sections = [];

  if (clean(p.summary)) {
    sections.push({ title: 'Summary', items: [{ body: clean(p.summary) }] });
  }

  const skills = (Array.isArray(p.skills) ? p.skills.map(clean) : []).filter(Boolean);
  if (skills.length) {
    sections.push({ title: 'Skills', items: [{ body: skills.join(', ') }] });
  }

  const experience = (Array.isArray(p.experience) ? p.experience : []).filter(
    (x) => clean(x?.title) || clean(x?.company) || clean(x?.description),
  );
  if (experience.length) {
    sections.push({
      title: 'Experience',
      items: experience.map((x) => ({
        heading: [clean(x.title), clean(x.company)].filter(Boolean).join(' — '),
        sub: dateRange(x.startDate, x.endDate),
        bullets: splitBullets(x.description),
      })),
    });
  }

  const education = (Array.isArray(p.education) ? p.education : []).filter(
    (x) => clean(x?.degree) || clean(x?.institution) || clean(x?.field),
  );
  if (education.length) {
    sections.push({
      title: 'Education',
      items: education.map((x) => {
        const degree = [clean(x.degree), clean(x.field)].filter(Boolean).join(', ');
        const tail = [clean(x.institution), clean(x.year)].filter(Boolean).join(' · ');
        return { heading: [degree, tail].filter(Boolean).join(' — '), bullets: [] };
      }),
    });
  }

  const projects = (Array.isArray(p.projects) ? p.projects : []).filter((x) => clean(x?.name) || clean(x?.description));
  if (projects.length) {
    sections.push({
      title: 'Projects',
      items: projects.map((x) => {
        const tech = (Array.isArray(x.tech) ? x.tech.map(clean) : []).filter(Boolean);
        return {
          heading: clean(x.name),
          sub: tech.length ? tech.join(', ') : '',
          body: clean(x.description),
          bullets: [],
        };
      }),
    });
  }

  const certs = (Array.isArray(p.certifications) ? p.certifications : []).filter((x) => clean(x?.name));
  if (certs.length) {
    sections.push({
      title: 'Certifications',
      items: certs.map((x) => ({
        heading: clean(x.name),
        sub: [clean(x.issuer), clean(x.year)].filter(Boolean).join(' · '),
      })),
    });
  }

  const languages = (Array.isArray(p.languages) ? p.languages : []).filter((x) => clean(x?.name));
  if (languages.length) {
    sections.push({
      title: 'Languages',
      items: languages.map((x) => ({ heading: clean(x.level) ? `${clean(x.name)} (${clean(x.level)})` : clean(x.name) })),
    });
  }

  const awards = (Array.isArray(p.awards) ? p.awards : []).filter((x) => clean(x?.title));
  if (awards.length) {
    sections.push({
      title: 'Awards',
      items: awards.map((x) => ({
        heading: clean(x.title),
        sub: [clean(x.issuer), clean(x.year)].filter(Boolean).join(' · '),
        body: clean(x.description),
      })),
    });
  }

  return {
    name: clean(p.fullName) || 'Your name',
    headline: clean(p.headline),
    contact,
    sections,
  };
}
