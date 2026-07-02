import { describe, it, expect } from 'vitest';
import { jsonLdToProfile, extractJsonLd } from '../profile/linkedin/jsonld.js';

// A representative schema.org Person node as LinkedIn embeds it in the public
// profile page's <script type="application/ld+json">. Modeled on a real capture.
const PERSON = {
  '@context': 'http://schema.org',
  '@type': 'Person',
  name: 'Bill Gates',
  jobTitle: ['Co-chair', 'Founder'],
  description: 'Chair of the Gates Foundation. Founder of Breakthrough Energy.',
  address: { '@type': 'PostalAddress', addressCountry: 'US', addressLocality: 'Seattle, Washington, United States' },
  worksFor: [
    { '@type': 'Organization', name: 'Gates Foundation', url: 'https://www.linkedin.com/company/gates-foundation', member: { '@type': 'OrganizationRole', startDate: 2000 } },
    { '@type': 'Organization', name: 'Microsoft ', member: { '@type': 'OrganizationRole', startDate: 1975, endDate: 2020 } },
  ],
  alumniOf: [
    { '@type': 'EducationalOrganization', name: 'Harvard University', member: { '@type': 'OrganizationRole', startDate: 1973, endDate: 1975 } },
  ],
  knowsLanguage: [{ '@type': 'Language', name: 'English' }],
  sameAs: 'https://www.linkedin.com/in/williamhgates',
  url: 'https://www.linkedin.com/in/williamhgates',
};

describe('jsonLdToProfile', () => {
  const p = jsonLdToProfile(PERSON);

  it('maps the top-card basics', () => {
    expect(p.fullName).toBe('Bill Gates');
    expect(p.headline).toBe('Co-chair, Founder'); // jobTitle[] joined
    expect(p.summary).toBe('Chair of the Gates Foundation. Founder of Breakthrough Energy.');
    expect(p.location).toBe('Seattle, Washington, United States');
  });

  it('maps worksFor to experience (company + years, no invented titles)', () => {
    expect(p.experience).toHaveLength(2);
    expect(p.experience[0]).toMatchObject({ company: 'Gates Foundation', startDate: '2000', endDate: 'Present', title: '' });
    expect(p.experience[1]).toMatchObject({ company: 'Microsoft', startDate: '1975', endDate: '2020' }); // trailing space trimmed
  });

  it('maps alumniOf to education (institution + year, blank degree/field)', () => {
    expect(p.education[0]).toMatchObject({ institution: 'Harvard University', year: '1975', degree: '', field: '' });
  });

  it('maps languages and keeps the profile url in links; never invents skills', () => {
    expect(p.languages).toEqual([{ name: 'English', level: '' }]);
    expect(p.skills).toEqual([]);
    expect(p.links).toContain('https://www.linkedin.com/in/williamhgates');
  });

  it('returns a fully normalized shape and tolerates a string jobTitle / missing fields', () => {
    const q = jsonLdToProfile({ name: 'A B', jobTitle: 'Engineer' });
    expect(q.headline).toBe('Engineer');
    expect(q.experience).toEqual([]);
    expect(q.education).toEqual([]);
    expect(q).toHaveProperty('certifications');
  });
});

describe('extractJsonLd', () => {
  it('pulls the Person node out of a page with multiple ld+json blocks', () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"http://schema.org","@type":"WebSite","name":"LinkedIn"}</script>
      <script type="application/ld+json">${JSON.stringify(PERSON)}</script>
      </head><body></body></html>`;
    const node = extractJsonLd(html);
    expect(node?.name).toBe('Bill Gates');
  });

  it('finds a Person inside an @graph wrapper', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@graph': [{ '@type': 'Organization', name: 'X' }, PERSON] })}</script>`;
    expect(extractJsonLd(html)?.name).toBe('Bill Gates');
  });

  it('returns null when there is no Person block', () => {
    expect(extractJsonLd('<html><body>no json-ld here</body></html>')).toBeNull();
    expect(extractJsonLd('<script type="application/ld+json">not json</script>')).toBeNull();
  });
});
