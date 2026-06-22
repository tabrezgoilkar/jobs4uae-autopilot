export interface CopilotTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Ask the career copilot. Returns the answer text. */
export async function askCopilot(question: string, history: CopilotTurn[] = []): Promise<string> {
  const res = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
  const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Server error ${res.status}`);
  return (body as { answer: string }).answer;
}
