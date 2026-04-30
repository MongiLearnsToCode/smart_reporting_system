import { getUser, createClient } from '../utils/auth';

function extractJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    const last = cleaned.lastIndexOf('```');
    if (last !== -1) cleaned = cleaned.slice(0, last).trim();
  }
  return JSON.parse(cleaned);
}

async function callGroq(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const { rawContent, type, fileUrl } = await request.json();
    const userId = user.id;

    const systemPrompt = [
      'You are an AI data extractor for Codex, a business intelligence platform.',
      'Extract structured data from the user log entry and return ONLY valid JSON with no markdown, no code blocks, and no explanation.',
      'Choose from these categories: Finance, Inventory, Projects, Clients, Tasks, Team, Marketing.',
      'If none fit, propose a short new category name.',
      'Today\'s date for resolving relative dates: ' + new Date().toISOString(),
      'Detect sentiment as: positive, neutral, or negative.',
      'Detect urgency as: low, medium, or high.',
      'Return this exact JSON structure:',
      '{ "category": "string", "summary": "one sentence summary", "entities": { "amount": number or null, "currency": "string or null", "date": "ISO date string", "sentiment": "positive or neutral or negative", "urgency": "low or medium or high", "names": ["array of person or company names"], "tags": ["array of relevant keywords"] } }',
    ].join('\n');

    const messageContent = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent },
    ]);

    const extracted = extractJson(messageContent);
    if (!extracted.category || !extracted.entities) {
      throw new Error('AI response missing required fields: ' + messageContent);
    }

    // Upsert category if new
    const { data: existingCats } = await supabase
      .from('categories')
      .select('name')
      .or(`user_id.eq.${userId},user_id.eq.system`);

    const catExists = existingCats?.some(
      (c) => c.name.toLowerCase() === extracted.category.toLowerCase()
    );

    if (!catExists) {
      await supabase.from('categories').upsert(
        { user_id: userId, name: extracted.category, color: '#94a3b8', is_proposed: true },
        { onConflict: 'user_id,name', ignoreDuplicates: true }
      );
    }

    // Conflict detection: same category logged today
    const today = new Date().toISOString().split('T')[0];
    const { data: similarLogs } = await supabase
      .from('logs')
      .select('id')
      .eq('user_id', userId)
      .eq('category', extracted.category)
      .gte('timestamp', today)
      .lt('timestamp', new Date(Date.now() + 86400000).toISOString().split('T')[0])
      .order('timestamp', { ascending: false })
      .limit(1);

    const isConflict = (similarLogs?.length ?? 0) > 0;
    const conflictSourceId = isConflict ? similarLogs[0].id : null;

    const { data: savedLog, error: insertError } = await supabase
      .from('logs')
      .insert({
        user_id: userId,
        raw_content: rawContent,
        type,
        file_url: fileUrl ?? null,
        category: extracted.category,
        entities: extracted.entities,
        is_conflict: isConflict,
        conflict_source_id: conflictSourceId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Ensure a widget exists for this category
    const { data: existingWidgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', userId)
      .contains('config', { category: extracted.category });

    if (!existingWidgets?.length) {
      let widgetType = 'metric';
      if (extracted.category === 'Finance') widgetType = 'chart';
      if (extracted.category === 'Tasks') widgetType = 'list';

      await supabase.from('widgets').insert({
        user_id: userId,
        type: widgetType,
        title: extracted.category,
        config: { category: extracted.category, w: 4, h: 2, x: 0, y: 0 },
      });
    }

    return Response.json({ success: true, log: savedLog });
  } catch (error) {
    console.error('api/process error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
