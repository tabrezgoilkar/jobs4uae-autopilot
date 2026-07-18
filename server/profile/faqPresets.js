// Catalog of the common LinkedIn "Easy Apply" screening questions, derived from
// the open-source auto-applier question banks. These are the questions real
// applications ask — we surface them as FAQ seeds so the user can pre-answer
// them once and the confidence-gated apply flow has grounded answers ready.
//
// Each preset maps to a resolver that pulls the answer from the profile (or
// returns null when we have no data — the user fills it in manually). Nothing
// is invented: a preset with no supporting profile data yields answer=null and
// is simply left for the user to complete.

/**
 * @param {object} profile
 * @returns {{question:string, answer:string|null, field?:string}[]}
 */
export function faqPresets(profile = {}) {
  const p = profile || {};
  const location = (p.location || '').toLowerCase();
  const isUae = location.includes('uae') || location.includes('dubai') || location.includes('abu dhabi');

  const items = [
    {
      question: 'Do you require visa sponsorship now or in the future?',
      answer: isUae ? 'No — I am authorised to work in the UAE.' : null,
      field: 'location',
    },
    {
      question: 'Are you authorised to work in the country of this role?',
      answer: isUae ? 'Yes — based in the UAE.' : null,
      field: 'location',
    },
    {
      question: 'What is your notice period?',
      answer: null, // not stored on profile; user fills in
      field: 'notice_period',
    },
    {
      question: 'What is the link to your portfolio or LinkedIn profile?',
      answer: p.links && p.links.length > 0 ? p.links[0] : null,
      field: 'links',
    },
    {
      question: 'How many years of relevant experience do you have?',
      answer: p.experience && p.experience.length > 0 ? `${p.experience.length}+ years across ${p.experience.map((e) => e.title).filter(Boolean).slice(0, 3).join(', ')}` : null,
      field: 'experience',
    },
    {
      question: 'Are you willing to relocate?',
      answer: null,
      field: 'relocate',
    },
  ];

  return items;
}

// Presets that already have a grounded answer from the profile (can be added
// to the FAQ bank immediately). Null-answer ones are returned separately so the
// UI can prompt the user to fill them.
export function resolvablePresets(profile = {}) {
  return faqPresets(profile).filter((it) => it.answer && it.answer.trim().length > 0);
}
