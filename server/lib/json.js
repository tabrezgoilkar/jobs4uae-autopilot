// Escape raw control chars (newlines/tabs) that appear INSIDE string literals.
// Weak models often emit real newlines inside long markdown values, which is
// invalid JSON; this repairs only string-internal control chars, leaving the
// document's structural formatting intact.
function escapeControlInStrings(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
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
    // Fallback: repair string-internal control chars and retry once.
    return JSON.parse(escapeControlInStrings(slice));
  }
}
