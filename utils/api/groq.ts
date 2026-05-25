type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function callGroq(messages: Message[]) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('AI provider is not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, stream: false }),
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
