// Deterministic "before tailoring" CV renderer.
// Turns the candidate's stored profile into ATS-style Markdown WITHOUT any AI —
// this is the honest baseline the Documents "what changed" diff compares against.

function clean(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function dateRange(startDate, endDate) {
  const s = clean(startDate);
  const e = clean(endDate);
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

/**
 * @param {object} profile - the stored candidate profile
 * @returns {string} Markdown representation of the profile as a plain CV
 */
export function renderProfileToMarkdown(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const out = [];

  // Header: name + headline
  out.push(`# ${clean(p.fullName) || 'Your name'}`);
  if (clean(p.headline)) out.push(`**${clean(p.headline)}**`);

  // Contact line
  const contact = [clean(p.email), clean(p.phone), clean(p.location), ...(Array.isArray(p.links) ? p.links.map(clean) : [])]
    .filter(Boolean);
  if (contact.length) out.push(contact.join(' · '));

  // Summary
  if (clean(p.summary)) {
    out.push('## Summary', clean(p.summary));
  }

  // Skills
  const skills = (Array.isArray(p.skills) ? p.skills.map(clean) : []).filter(Boolean);
  if (skills.length) {
    out.push('## Skills', skills.join(', '));
  }

  // Experience
  const experience = (Array.isArray(p.experience) ? p.experience : []).filter(
    (x) => clean(x?.title) || clean(x?.company) || clean(x?.description),
  );
  if (experience.length) {
    out.push('## Experience');
    for (const x of experience) {
      const heading = [clean(x.title), clean(x.company)].filter(Boolean).join(' — ');
      if (heading) out.push(`### ${heading}`);
      const range = dateRange(x.startDate, x.endDate);
      if (range) out.push(`*${range}*`);
      if (clean(x.description)) out.push(clean(x.description));
    }
  }

  // Education
  const education = (Array.isArray(p.education) ? p.education : []).filter(
    (x) => clean(x?.degree) || clean(x?.institution) || clean(x?.field),
  );
  if (education.length) {
    out.push('## Education');
    for (const x of education) {
      const degree = [clean(x.degree), clean(x.field)].filter(Boolean).join(', ');
      const tail = [clean(x.institution), clean(x.year)].filter(Boolean).join(' · ');
      out.push(`- ${[degree, tail].filter(Boolean).join(' — ')}`.trimEnd());
    }
  }

  // Projects
  const projects = (Array.isArray(p.projects) ? p.projects : []).filter((x) => clean(x?.name) || clean(x?.description));
  if (projects.length) {
    out.push('## Projects');
    for (const x of projects) {
      const tech = (Array.isArray(x.tech) ? x.tech.map(clean) : []).filter(Boolean);
      const bits = [clean(x.description), tech.length ? `(${tech.join(', ')})` : '', clean(x.url)].filter(Boolean);
      out.push(`- **${clean(x.name) || 'Project'}**${bits.length ? ` — ${bits.join(' ')}` : ''}`);
    }
  }

  // Certifications
  const certs = (Array.isArray(p.certifications) ? p.certifications : []).filter((x) => clean(x?.name));
  if (certs.length) {
    out.push('## Certifications');
    for (const x of certs) {
      const tail = [clean(x.issuer), clean(x.year)].filter(Boolean).join(' · ');
      out.push(`- ${clean(x.name)}${tail ? ` — ${tail}` : ''}`);
    }
  }

  // Languages
  const languages = (Array.isArray(p.languages) ? p.languages : []).filter((x) => clean(x?.name));
  if (languages.length) {
    out.push('## Languages');
    out.push(languages.map((x) => (clean(x.level) ? `${clean(x.name)} (${clean(x.level)})` : clean(x.name))).join(', '));
  }

  // Awards
  const awards = (Array.isArray(p.awards) ? p.awards : []).filter((x) => clean(x?.title));
  if (awards.length) {
    out.push('## Awards');
    for (const x of awards) {
      const tail = [clean(x.issuer), clean(x.year)].filter(Boolean).join(' · ');
      const desc = clean(x.description);
      out.push(`- **${clean(x.title)}**${tail ? ` — ${tail}` : ''}${desc ? `. ${desc}` : ''}`);
    }
  }

  return out.join('\n\n');
}
