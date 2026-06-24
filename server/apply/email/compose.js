import { extractJson } from '../../lib/json.js';

// Email-Apply for "send your CV to hr@…" post-jobs (the easiest legitimate
// channel — no form, no anti-bot). Composes a tailored application email from the
// REAL profile (no fabrication) and builds review-before-send draft links. The
// user reviews and sends; we never bulk-send.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Recruiter emails found in a pasted post (deduped, lowercased, in order). */
export function extractEmails(text) {
  const matches = String(text ?? '').match(EMAIL_RE) ?? [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const e = m.toLowerCase();
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

export function mailtoLink({ to, subject, body }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function gmailComposeLink({ to, subject, body }) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const SYSTEM =
  'You draft a concise, professional job-application email for a real person. ' +
  'Use ONLY facts present in their profile — never invent employers, dates, numbers or skills. Return ONLY JSON.';

function buildPrompt(profile, jobText, recruiter) {
  return `Write a short application email (5–9 sentences) for this job.

CANDIDATE PROFILE (the only source of facts):
${JSON.stringify({ fullName: profile.fullName, headline: profile.headline, summary: profile.summary, skills: profile.skills }, null, 2)}

JOB / RECRUITER POST:
"""${jobText}"""
${recruiter?.company ? `Company: ${recruiter.company}` : ''}

Rules: professional and warm; reference fit using only profile facts; mention the CV is attached; no fabricated details; sign off with the candidate's name.
Return ONLY: {"subject":"…","body":"…"}`;
}

export async function composeApplicationEmail(profile, jobText, recruiter, engine) {
  let parsed;
  try {
    parsed = extractJson(await engine.generate({ system: SYSTEM, prompt: buildPrompt(profile, jobText, recruiter) }));
  } catch (e) {
    throw new Error(`Could not understand the AI response while drafting your email. ${e.message}`);
  }
  const fallbackSubject = profile.headline
    ? `Application: ${profile.headline} — ${profile.fullName}`
    : `Job application — ${profile.fullName}`;
  return {
    subject: String(parsed.subject ?? '').trim() || fallbackSubject,
    body: String(parsed.body ?? '').trim(),
  };
}
