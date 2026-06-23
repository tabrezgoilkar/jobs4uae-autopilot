// Turn an arbitrary job-posting HTML page into plain text suitable for the
// evaluator. Deterministic, dependency-free. Used by the "paste a job link" flow.

const MAX = 12000; // keep the AI prompt bounded

export function htmlToJobText(html) {
  if (typeof html !== 'string' || !html) return '';
  const text = html
    // drop script/style/noscript and their contents
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // block-ish tags → newline so structure survives a little
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|br)>/gi, '\n')
    // strip all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // decode the few common entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    // collapse whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX);
}
