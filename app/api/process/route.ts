import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

function extractJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    const last = cleaned.lastIndexOf('```');
    if (last !== -1) cleaned = cleaned.slice(0, last).trim();
  }
  return JSON.parse(cleaned);
}

async function callGroq(messages: any[]) {
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { rawContent, type, fileUrl } = await request.json();
    const userId = user.id;

    // Load user settings
    const { data: settingsRow } = await admin.from('user_settings').select('*').eq('user_id', userId).single();
    const settings = settingsRow ?? {};
    const currency = settings.currency ?? 'USD';
    const timezone = settings.timezone ?? 'UTC';
    const aiLanguage = settings.ai_language ?? 'English';
    const conflictDetection = settings.conflict_detection !== false;
    const conflictDismissDays = settings.conflict_dismiss_days ?? 7;

    const systemPrompt = [
      'You are an AI data extractor for Codex, a business intelligence platform.',
      'Extract structured data from the user log entry and return ONLY valid JSON with no markdown, no code blocks, and no explanation.',
      'Choose from these categories: Finance, Inventory, Projects, Clients, Tasks, Team, Marketing.',
      'If none fit, propose a short new category name.',
      `Today's date for resolving relative dates: ${new Date().toLocaleString('en-US', { timeZone: timezone })} (timezone: ${timezone})`,
      `Default currency: ${currency}. Use this when no currency is specified.`,
      `Write the summary in ${aiLanguage}.`,
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
    const { data: existingCats } = await admin
      .from('categories')
      .select('name')
      .or(`user_id.eq.${userId},user_id.eq.system`);

    const catExists = existingCats?.some(
      (c: any) => c.name.toLowerCase() === extracted.category.toLowerCase()
    );

    if (!catExists) {
      await admin.from('categories').upsert(
        { user_id: userId, name: extracted.category, color: '#94a3b8', is_proposed: true },
        { onConflict: 'user_id,name', ignoreDuplicates: true }
      );
    }

    // Conflict detection: fetch recent logs in same category, then ask AI to compare content
    const windowStart = new Date(Date.now() - conflictDismissDays * 86400000).toISOString();
    const { data: recentLogs } = conflictDetection ? await admin
      .from('logs')
      .select('id, raw_content')
      .eq('user_id', userId)
      .eq('category', extracted.category)
      .gte('timestamp', windowStart)
      .order('timestamp', { ascending: false })
      .limit(5) : { data: null };

    let isConflict = false;
    let conflictSourceId: string | null = null;
    let conflictReason: string | null = null;

    if (conflictDetection && recentLogs && recentLogs.length > 0) {
      const comparisons = recentLogs.map((l: any, i: number) => `[${i + 1}] ${l.raw_content}`).join('\n\n');
      const similarityPrompt = `You are a duplicate-detection assistant. Compare the NEW entry against each EXISTING entry and return ONLY valid JSON.

NEW ENTRY:
${rawContent}

EXISTING ENTRIES TODAY (same category):
${comparisons}

Rules:
- "duplicate": true only if the new entry conveys identical or near-identical information as an existing entry (more similarities than differences in actual content, facts, or figures).
- "duplicate": false if the entries are merely in the same category but describe different events, amounts, people, or dates.
- If duplicate, set "source_index" to the 1-based index of the most similar existing entry, and "reason" to a one-sentence plain-English explanation of why they are duplicates.

Return: { "duplicate": boolean, "source_index": number | null, "reason": string | null }`;

      const similarityResult = await callGroq([{ role: 'user', content: similarityPrompt }]);
      const similarity = extractJson(similarityResult);

      if (similarity.duplicate && similarity.source_index != null) {
        isConflict = true;
        conflictSourceId = (recentLogs as any)[similarity.source_index - 1].id;
        conflictReason = similarity.reason ?? null;
      }
    }

    const { data: savedLog, error: insertError } = await admin
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
        conflict_reason: conflictReason,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Ensure a widget exists for this category
    const { data: existingWidgets } = await admin
      .from('widgets')
      .select('id')
      .eq('user_id', userId)
      .contains('config', { category: extracted.category });

    if (!existingWidgets?.length) {
      let widgetType = 'metric';
      if (extracted.category === 'Finance') widgetType = 'chart';
      if (extracted.category === 'Tasks') widgetType = 'list';

      await admin.from('widgets').insert({
        user_id: userId,
        type: widgetType,
        title: extracted.category,
        config: { category: extracted.category, w: 4, h: 2, x: 0, y: 0 },
      });
    }

    return NextResponse.json({ success: true, log: savedLog });
  } catch (error: any) {
    console.error('api/process error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
