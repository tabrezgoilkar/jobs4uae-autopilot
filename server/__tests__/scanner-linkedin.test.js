import { describe, test, expect } from 'vitest';
import linkedin, {
  buildSearchUrl,
  parseJobCards,
  parseJobDetail,
  fetchJobDetail,
} from '../scanner/boards/linkedin.js';

// Minimal search-card markup mirroring the upstream reference fixtures.
function searchCard(id, title, company = 'Acme') {
  return `<li>
    <div data-entity-urn="urn:li:jobPosting:${id}">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}"></a>
      <h3 class="base-search-card__title">${title}</h3>
      <h4 class="base-search-card__subtitle"><a href="https://www.linkedin.com/company/acme">${company}</a></h4>
    </div>
  </li>`;
}

describe('scanner board contract', () => {
  test('board shape matches the scanner engine contract', () => {
    expect(linkedin.id).toBe('linkedin');
    expect(typeof linkedin.name).toBe('string');
    expect(typeof linkedin.buildSearchUrl).toBe('function');
    expect(typeof linkedin.parseListings).toBe('function');
  });

  test('scan() resolves linkedin through the engine', async () => {
    const { BOARDS } = await import('../scanner/engine.js');
    expect(BOARDS.find((b) => b.id === 'linkedin')).toBe(linkedin);
  });
});

describe('buildSearchUrl', () => {
  test('passes country through as the LinkedIn location (free-text geocode)', () => {
    const u = new URL(buildSearchUrl({ keyword: 'react', country: 'UAE' }));
    expect(u.searchParams.get('keywords')).toBe('react');
    expect(u.searchParams.get('location')).toBe('UAE');
    expect(u.searchParams.get('start')).toBe('0');
  });

  test('city overrides country for location', () => {
    const u = new URL(buildSearchUrl({ keyword: 'devops', country: 'UAE', city: 'Dubai' }));
    expect(u.searchParams.get('location')).toBe('Dubai');
  });

  test('remote maps to f_WT=2', () => {
    const u = new URL(buildSearchUrl({ keyword: 'pm', country: 'UAE', remote: 'remote' }));
    expect(u.searchParams.get('f_WT')).toBe('2');
  });

  test('jobAge maps to f_TPR in seconds', () => {
    const u = new URL(buildSearchUrl({ keyword: 'qa', country: 'UAE', jobAge: 7 }));
    expect(u.searchParams.get('f_TPR')).toBe(`r${7 * 86400}`);
  });

  test('no f_TPR when jobAge omitted', () => {
    const u = new URL(buildSearchUrl({ keyword: 'qa', country: 'UAE' }));
    expect(u.searchParams.has('f_TPR')).toBe(false);
  });

  test('page offset math (10 per page)', () => {
    const u = new URL(buildSearchUrl({ keyword: 'x', country: 'UAE', page: 3 }));
    expect(u.searchParams.get('start')).toBe('20');
  });
});

describe('parseJobCards — entity decoding', () => {
  test('decodes hexadecimal numeric entities (&#xE9;)', () => {
    const [card] = parseJobCards(searchCard('123', 'Caf&#xE9; Manager'));
    expect(card.title).toBe('Café Manager');
  });
  test('decodes decimal numeric entities (&#233;)', () => {
    const [card] = parseJobCards(searchCard('125', 'Caf&#233; Lead'));
    expect(card.title).toBe('Café Lead');
  });
  test('decodes supplementary-plane code points (&#128512;)', () => {
    const [card] = parseJobCards(searchCard('126', 'Growth &#128512;'));
    expect(card.title).toBe('Growth 😀');
  });
  test('decodes hex entities in the company subtitle', () => {
    const [card] = parseJobCards(searchCard('128', 'Engineer', 'N&#xF8;rrebro ApS'));
    expect(card.company).toBe('Nørrebro ApS');
  });

  test('skips malformed cards but keeps good ones (chunk isolation)', () => {
    const html = searchCard('1', 'Good') + '<li>garbage no urn</li>' + searchCard('2', 'Also Good');
    const cards = parseJobCards(html);
    expect(cards.map((c) => c.id)).toEqual(['1', '2']);
  });

  test('extracts location and date', () => {
    const html = `<li><div data-entity-urn="urn:li:jobPosting:9">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/9"></a>
      <h3 class="base-search-card__title">Eng</h3>
      <h4 class="base-search-card__subtitle"><a href="https://www.linkedin.com/company/x">Co</a></h4>
      <span class="job-search-card__location">Dubai, UAE</span>
      <time class="job-search-card__listdate" datetime="2026-07-01">1d</time>
    </div></li>`;
    const [card] = parseJobCards(html);
    expect(card.location).toBe('Dubai, UAE');
    expect(card.date).toBe('2026-07-01');
  });
});

describe('parseJobDetail', () => {
  test('decodes hex entities in the title and extracts criteria', () => {
    const html = `<h1 class="topcard__title">Se&#xF1;or Engineer</h1>
      <a class="topcard__org-name-link" href="https://www.linkedin.com/company/acme">Acme</a>
      <span class="topcard__flavor topcard__flavor--bullet">Dubai, UAE</span>
      <h3 class="description__job-criteria-subheader">Seniority level</h3>
      <span class="description__job-criteria-text">Mid-Senior</span>
      <h3 class="description__job-criteria-subheader">Employment type</h3>
      <span class="description__job-criteria-text">Full-time</span>`;
    const job = parseJobDetail(html, '999');
    expect(job.title).toBe('Señor Engineer');
    expect(job.company).toBe('Acme');
    expect(job.location).toBe('Dubai, UAE');
    expect(job.seniority).toBe('Mid-Senior');
    expect(job.employmentType).toBe('Full-time');
  });

  test('keeps line breaks in the description', () => {
    const html = `<div class="show-more-less-html__markup"><p>First line</p><br>Second line</div>`;
    const job = parseJobDetail(html, '1');
    expect(job.description).toContain('First line');
    expect(job.description).toContain('Second line');
  });
});

describe('parseListings (board contract)', () => {
  test('maps cards to normalized listings with source=linkedin and jobId', () => {
    const html = searchCard('555', 'Backend Dev', 'Careem');
    const listings = linkedin.parseListings(html, { country: 'UAE' });
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      title: 'Backend Dev',
      company: 'Careem',
      source: 'linkedin',
      jobId: '555',
      country: 'UAE',
    });
    expect(listings[0].url).toBe('https://www.linkedin.com/jobs/view/555');
  });

  test('empty html yields no listings', () => {
    expect(linkedin.parseListings('', {})).toEqual([]);
  });
});

describe('fetchJobDetail', () => {
  test('calls fetchHtml with the jobPosting url and parses detail', async () => {
    const fakeHtml = `<h1 class="topcard__title">PM</h1>
      <a class="topcard__org-name-link" href="https://www.linkedin.com/company/p">Pco</a>`;
    const fetchHtml = async (url) => {
      expect(url).toContain('/jobPosting/42');
      return fakeHtml;
    };
    const detail = await fetchJobDetail('42', fetchHtml);
    expect(detail.title).toBe('PM');
    expect(detail.company).toBe('Pco');
  });

  test('null html -> null', async () => {
    const detail = await fetchJobDetail('1', async () => null);
    expect(detail).toBeNull();
  });
});
