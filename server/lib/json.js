import { jsonrepair } from 'jsonrepair';

// Repair string-INTERNAL problems that weak models emit inside JSON string
// literals, leaving the document's structural formatting intact:
//   1. Raw control chars (real newlines/tabs) -> \n \r \t.
//   2. Invalid backslash escapes -> escaped backslash. Models told to preserve
//      Markdown emit \* \- \( etc., and CV text carries literal backslashes
//      (Windows paths "C:\Users", "TCP\IP", "24\7"). JSON only allows
//      \" \\ \/ \b \f \n \r \t \uXXXX, so any other escape is repaired to \\.
const VALID_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const isHex = (c) => c !== undefined && /[0-9a-fA-F]/.test(c);

function repairStringInternals(s) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (!inStr) { out += ch; continue; }
    if (ch === '\n') { out += '\\n'; continue; }
    if (ch === '\r') { out += '\\r'; continue; }
    if (ch === '\t') { out += '\\t'; continue; }
    if (ch === '\\') {
      const next = s[i + 1];
      // Valid single-char escape: emit both, skip the escaped char.
      if (VALID_ESCAPES.has(next)) { out += ch + next; i++; continue; }
      // Valid \uXXXX: emit the whole unit, skip past it.
      if (next === 'u' && isHex(s[i + 2]) && isHex(s[i + 3]) && isHex(s[i + 4]) && isHex(s[i + 5])) {
        out += s.slice(i, i + 6); i += 5; continue;
      }
      // Stray/invalid backslash: escape it so the literal survives.
      out += '\\\\'; continue;
    }
    out += ch;
  }
  return out;
}

export function extractJson(text) {
  if (!text) throw new Error('Empty AI response.');
  let t = String(text).trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI did not return JSON.');
  const slice = t.slice(start, end + 1);
  // Weak models return almost-JSON in many ways. Try increasingly aggressive
  // repairs, cheapest and most faithful first:
  //   1. as-is;
  //   2. repairStringInternals — fixes control chars / bad escapes while
  //      PRESERVING literal backslashes (e.g. "C:\Users", markdown "\*");
  //   3. jsonrepair over (2) — also fixes structural junk (JS comments, missing
  //      commas, single quotes, trailing commas, unquoted values) on top of the
  //      faithful backslash handling;
  //   4. jsonrepair over the raw slice — last resort for inputs that step 2's
  //      quote tracking would mis-handle (e.g. quotes inside a // comment).
  const attempts = [
    () => JSON.parse(slice),
    () => JSON.parse(repairStringInternals(slice)),
    () => JSON.parse(jsonrepair(repairStringInternals(slice))),
    () => JSON.parse(jsonrepair(slice)),
  ];
  let lastErr;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
