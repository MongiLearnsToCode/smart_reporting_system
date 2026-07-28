type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export type GroqModel = 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile';

const SHORT_TEXT_LIMIT = 300;

/**
 * Tiered routing: short plain-text logs go to the fast 8B model, anything
 * complex (long text, file content) to the 70B. Deliberately no reasoning
 * model — latency works against the 2s budget (see spec).
 */
export function pickExtractionModel(rawContent: string, type: 'text' | 'file'): GroqModel {
  return type === 'text' && rawContent.length < SHORT_TEXT_LIMIT
    ? 'llama-3.1-8b-instant'
    : 'llama-3.3-70b-versatile';
}

export async function callGroq(messages: Message[], model: GroqModel = 'llama-3.3-70b-versatile') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('AI provider is not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) throw new Error(`AI provider request failed with status ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI provider returned an invalid response');
  return content;
}

/**
 * Escapes raw control characters that appear inside JSON string literals.
 *
 * Models routinely emit a literal newline inside a quoted string. That is
 * invalid JSON, and JSON.parse rejects the whole document over it — so one
 * stray line break in one section discarded an entire report's narration and
 * silently dropped it to the deterministic fallback. Tracking string state is
 * enough to fix it without touching structure: only characters inside a string
 * are escaped, so nothing about the shape of the JSON can change.
 */
function escapeControlChars(json: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (inString && code < 0x20) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t'
        : '\\u' + code.toString(16).padStart(4, '0');
      continue;
    }
    out += ch;
  }
  return out;
}

export function extractJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    const last = cleaned.lastIndexOf('```');
    if (last !== -1) cleaned = cleaned.slice(0, last).trim();
  }
  return JSON.parse(escapeControlChars(cleaned));
}
