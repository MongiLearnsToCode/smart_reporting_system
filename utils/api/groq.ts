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

export function extractJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    const last = cleaned.lastIndexOf('```');
    if (last !== -1) cleaned = cleaned.slice(0, last).trim();
  }
  return JSON.parse(cleaned);
}
