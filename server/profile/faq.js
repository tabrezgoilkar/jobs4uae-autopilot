// Deterministic, grounded FAQ-bank generation from a profile.
//
// Design: the STRUCTURE and the unsupported-answer handling are deterministic
// (no AI). For questions that HAVE supporting profile facts, we pass the facts
// to the engine ONLY to phrase a natural-language answer — the engine may never
// invent facts, because we feed it the exact grounded strings and instruct it
// to reuse them. If the engine is null or throws, we fall back to the raw facts
// so the route never breaks. Salary / availability / start-date are not profile
// fields → answered "Not specified." with NO engine call.

import { resolvablePresets } from './faqPresets.js';

// Questions that can be answered purely from the profile (deterministic).
const FACTFUL_TEMPLATES = [
  { q: 'Why are you a strong fit for this role?', pick: (p) => summaryOrHighlights(p) },
  { q: 'What is your most relevant experience?', pick: (p) => topExperience(p) },
  { q: 'Which of your skills are most relevant?', pick: (p) => (p.skills || []).slice(0, 5).join(', ') },
  { q: 'Tell us about a project you led.', pick: (p) => topProject(p) },
  { q: 'What certifications do you hold?', pick: (p) => certs(p), onlyIf: (p) => (p.certifications || []).length > 0 },
  { q: 'What languages do you speak?', pick: (p) => (p.languages || []).map((l) => l.name + (l.level ? ` (${l.level})` : '')).join(', '), onlyIf: (p) => (p.languages || []).length > 0 },
  { q: 'What awards or recognition have you received?', pick: (p) => (p.awards || []).map((a) => a.title).join(', '), onlyIf: (p) => (p.awards || []).length > 0 },
  { q: 'What is your educational background?', pick: (p) => education(p), onlyIf: (p) => (p.education || []).length > 0 },
];

// Questions asked of everyone, but with no profile support → "Not specified."
const ALWAYS_ASKED = [
  { q: 'What are your salary expectations?', answer: 'Not specified.' },
  { q: 'When would you be available to start?', answer: 'Not specified.' },
  { q: 'Are you authorized to work in the UAE?', answer: 'Yes — based in the UAE.', onlyIf: (p) => (p.location || '').toLowerCase().includes('uae') },
];

function summaryOrHighlights(p) {
  if (p.summary?.trim()) return p.summary.trim();
  const exp = (p.experience || [])[0];
  const bits = [p.headline || p.fullName, exp?.title, exp?.company].filter(Boolean);
  return bits.length > 1 ? `${bits[0]}: ${bits.slice(1).join(' at ')}.` : (bits[0] || 'Not specified.');
}
function topExperience(p) {
  const e = (p.experience || [])[0];
  if (!e) return 'Not specified.';
  const title = e.title || 'your role';
  const rest = [e.company, e.description].filter(Boolean).join(' — ');
  return rest ? `${title} — ${rest}`.trim() : title;
}
function topProject(p) {
  const pr = (p.projects || [])[0];
  return pr ? `${pr.name}: ${pr.description || ''}`.trim() : 'Not specified.';
}
function certs(p) {
  return (p.certifications || []).map((c) => c.name + (c.issuer ? ` (${c.issuer})` : '')).join(', ') || 'Not specified.';
}
function education(p) {
  return (p.education || []).map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(' ')).join('; ') || 'Not specified.';
}

function factsFor(p, pick) {
  const v = pick(p);
  return String(v || '').trim();
}

export async function generateFaqBank(profile = {}, engine = null) {
  const p = profile || {};
  const bank = [];

  for (const t of FACTFUL_TEMPLATES) {
    if (t.onlyIf && !t.onlyIf(p)) continue;
    const facts = factsFor(p, t.pick);
    if (!facts) continue;
    let answer = facts;
    if (engine && typeof engine.generate === 'function') {
      try {
        const raw = await engine.generate({
          system: 'Rephrase the supplied facts into a confident first-person answer. Do NOT add any fact not present in the facts. Return JSON: {"answer": string}',
          prompt: `Question: ${t.q}\nFacts:\n${facts}`,
        });
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.answer && String(parsed.answer).trim()) answer = String(parsed.answer).trim();
      } catch {
        answer = facts; // fallback to raw grounded facts
      }
    }
    bank.push({ question: t.q, answer });
  }

  for (const t of ALWAYS_ASKED) {
    if (t.onlyIf && !t.onlyIf(p)) continue;
    bank.push({ question: t.q, answer: t.answer });
  }

  // Seed the common LinkedIn "Easy Apply" screening questions that we can
  // already answer from the profile (visa status, portfolio, experience…).
  // Sourced from the open-source auto-applier question catalogs; only the
  // resolvable ones are added (null-answer presets are left for the user).
  for (const preset of resolvablePresets(p)) {
    if (!bank.some((b) => b.question === preset.question)) {
      bank.push({ question: preset.question, answer: preset.answer });
    }
  }

  // Guarantee a sane minimum even for an empty profile.
  if (bank.length < 3) {
    bank.push({ question: 'Why should we consider you?', answer: p.summary?.trim() || 'Not specified.' });
  }

  // Cap at 12.
  return bank.slice(0, 12);
}
