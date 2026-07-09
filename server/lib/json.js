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
  try {
    return JSON.parse(slice);
  } catch {
    // Fallback: repair string-internal control chars / bad escapes, retry once.
    return JSON.parse(repairStringInternals(slice));
  }
}
