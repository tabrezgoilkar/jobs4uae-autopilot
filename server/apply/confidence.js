// Deterministic confidence-grading for auto-apply answers.
// NO LLM call here — grading is pure, reproducible logic so the tool never
// blindly submits an answer it can't ground in the user's real profile/FAQ.
//
// Contract (mirrors the unit tests):
//   gradeAnswer(question, answerDraft, profile, faq) -> { confidence:'high'|'low', reference?:string }
//   gradeEvaluation(answers, profile, faq) -> { submitted:[...], review:[...] }
//   significanceTokens(text) -> string[]

const STOPWORDS = new Set([
  'a','an','the','and','or','but','to','of','in','on','for','with','is','are','was','were',
  'i','you','he','she','it','we','they','my','your','our','their','me','am','be','been','being',
  'this','that','these','those','at','by','from','as','do','does','did','have','has','had','will',
  'would','can','could','should','may','might','not','no','yes','into','about','than','then','so',
]);

function significanceTokens(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Flatten every user-claimable fact into a searchable pool with a reference id.
function factPool(profile = {}, faq = []) {
  const pool = [];
  const push = (ref, value) => {
    const v = String(value ?? '').trim();
    if (v) pool.push({ ref, tokens: significanceTokens(v), raw: v.toLowerCase() });
  };
  push('fullName', profile.fullName);
  push('headline', profile.headline);
  push('summary', profile.summary);
  push('location', profile.location);
  (profile.skills || []).forEach((s, i) => push(`skills[${i}]`, s));
  (profile.experience || []).forEach((e, i) => {
    push(`experience[${i}].title`, e?.title);
    push(`experience[${i}].company`, e?.company);
    push(`experience[${i}].description`, e?.description);
  });
  (profile.education || []).forEach((e, i) => {
    push(`education[${i}].institution`, e?.institution);
    push(`education[${i}].degree`, e?.degree);
    push(`education[${i}].field`, e?.field);
  });
  (profile.projects || []).forEach((p, i) => {
    push(`projects[${i}].name`, p?.name);
    push(`projects[${i}].description`, p?.description);
    push(`projects[${i}].tech`, (p?.tech || []).join(' '));
  });
  (profile.certifications || []).forEach((c, i) => push(`certifications[${i}].name`, c?.name));
  (profile.languages || []).forEach((l, i) => push(`languages[${i}].name`, l?.name));
  (profile.awards || []).forEach((a, i) => {
    push(`awards[${i}].title`, a?.title);
    push(`awards[${i}].description`, a?.description);
  });
  (faq || []).forEach((f, i) => {
    push(`faq[${i}].question`, f?.question);
    push(`faq[${i}].answer`, f?.answer);
  });
  return pool;
}

export function gradeAnswer(question, answerDraft, profile = {}, faq = [], grounded = []) {
  const answer = String(answerDraft ?? '').trim();
  if (!answer) return { confidence: 'low', reference: undefined };

  // Already-confirmed answers (remembered answers + application-detail fields)
  // are themselves grounding — if the drafted answer matches one verbatim (or
  // shares its significant tokens), it is high-confidence and may be submitted.
  const groundedAnswers = (grounded || []).map((g) => String(g?.answer ?? g?.text ?? '')).filter(Boolean);
  const answerLow = answer.toLowerCase();
  for (const g of groundedAnswers) {
    const gl = g.toLowerCase();
    if (gl && (answerLow === gl || answerLow.includes(gl) || gl.includes(answerLow))) {
      return { confidence: 'high', reference: 'memory' };
    }
  }

  const pool = factPool(profile, faq);
  const answerTokens = new Set(significanceTokens(answer));
  if (answerTokens.size === 0) return { confidence: 'low', reference: undefined };

  // An answer is "grounded" if a meaningful share of its significant tokens
  // appear in a single profile/FAQ fact (i.e. it restates something the user
  // actually claimed). Threshold keeps vague filler from passing.
  const TOKEN_THRESHOLD = 2;
  let best = null;
  for (const fact of pool) {
    let overlap = 0;
    for (const t of answerTokens) if (fact.tokens.includes(t)) overlap++;
    if (overlap >= TOKEN_THRESHOLD && (!best || overlap > best.overlap)) {
      best = { ref: fact.ref, overlap };
    }
  }

  if (best) return { confidence: 'high', reference: best.ref };
  return { confidence: 'low', reference: undefined };
}

export function gradeEvaluation(answers = [], profile = {}, faq = []) {
  const submitted = [];
  const review = [];
  for (const a of answers) {
    const answer = String(a?.answer ?? '').trim();
    if (!answer) continue; // blank → neither submit nor review
    const grade = gradeAnswer(a.label ?? a.question ?? '', answer, profile, faq);
    if (grade.confidence === 'high') {
      submitted.push({ ...a, confidence: 'high', reference: grade.reference });
    } else {
      review.push({
        ...a,
        confidence: 'low',
        missingReference: grade.reference ?? 'profile/FAQ',
      });
    }
  }
  return { submitted, review };
}

export { significanceTokens };
