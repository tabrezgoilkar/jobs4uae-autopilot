import { extractJson } from '../lib/json.js';

const SALARY_SYSTEM =
  'You are a GCC (UAE, Saudi, Qatar, Kuwait, Bahrain, Oman) compensation analyst. ' +
  'Give realistic, honest market salary RANGES. Never invent precision you do not have. Return ONLY valid JSON.';

export function buildSalaryPrompt(title, country, city) {
  const where = [city, country].filter((x) => (x ?? '').toString().trim()).join(', ') || 'the GCC';
  return `Estimate a realistic market salary RANGE for this role, for someone hired locally:

ROLE: ${title || 'the role'}
LOCATION: ${where}

Base it on typical GCC market pay. If you genuinely cannot estimate, return nulls and say why in "note".
Return JSON with EXACTLY these keys:
{
  "low": number,        // lower end of the typical range
  "high": number,       // upper end of the typical range
  "currency": string,   // local currency code, e.g. "AED", "SAR", "QAR"
  "period": "month" | "year",
  "note": string        // one short caveat sentence (it's an estimate)
}`;
}

function toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const digits = v.replace(/[^\d.]/g, '');
    if (digits) {
      const n = Number(digits);
      if (Number.isFinite(n)) return Math.round(n);
    }
  }
  return null;
}

export function normalizeSalary(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const periodRaw = (r.period ?? '').toString().toLowerCase();
  const period = /year|annual|annum|yr|p\.?a/.test(periodRaw) ? 'year' : 'month';
  return {
    low: toNumber(r.low),
    high: toNumber(r.high),
    currency: typeof r.currency === 'string' && r.currency.trim() ? r.currency.trim() : 'AED',
    period,
    note: typeof r.note === 'string' ? r.note : '',
  };
}

/** AI-estimated GCC salary range for a role. Returns a normalized estimate. */
export async function estimateSalary({ title, country, city }, engine) {
  const raw = await engine.generate({
    system: SALARY_SYSTEM,
    prompt: buildSalaryPrompt(title, country, city),
  });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch {
    // Honest fallback — no fabricated numbers.
    return { low: null, high: null, currency: 'AED', period: 'month', note: 'Could not estimate a range for this role.' };
  }
  return normalizeSalary(parsed);
}
