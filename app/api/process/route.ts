import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson } from '@/utils/api/groq';
import { parseProcessPayload } from '@/utils/api/validation';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`process:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { rawContent, type, fileUrl } = parseProcessPayload(await request.json());
    const userId = user.id;

    // Load user settings
    const { data: settingsRow } = await admin.from('user_settings').select('*').eq('user_id', userId).single();
    const settings = settingsRow ?? {};
    const currency = settings.currency ?? 'USD';
    const timezone = settings.timezone ?? 'UTC';
    const aiLanguage = settings.ai_language ?? 'English';
    const conflictDetection = settings.conflict_detection !== false;
    const conflictDismissDays = settings.conflict_dismiss_days ?? 7;

    // Known clients for normalization: dedupe entities->client from recent logs
    const { data: clientRows } = await admin
      .from('logs')
      .select('entities->client')
      .eq('user_id', userId)
      .not('entities->client', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(200);
    const knownClients = Array.from(new Set(
      (clientRows ?? [])
        .map((r: { client: unknown }) => (typeof r.client === 'string' ? r.client.trim() : ''))
        .filter(Boolean),
    ));

    const systemPrompt = [
      'You are an AI data extractor for Codex, a reporting platform for consultants and agencies.',
      'Extract structured data from the user log entry and return ONLY valid JSON with no markdown, no code blocks, and no explanation.',
      'Choose from these categories: Finance, Inventory, Projects, Clients, Tasks, Team, Marketing.',
      'If none fit, propose a short new category name.',
      `Today's date for resolving relative dates: ${new Date().toLocaleString('en-US', { timeZone: timezone })} (timezone: ${timezone})`,
      `Default currency: ${currency}. Use this when no currency is specified.`,
      `Write the summary in ${aiLanguage}.`,
      'Detect sentiment as: positive, neutral, or negative.',
      'Detect urgency as: low, medium, or high.',
      'Identify which client (customer/account the work or money relates to) this entry is for, if any.',
      knownClients.length
        ? `Known clients: ${knownClients.join(', ')}. If the entry refers to one of these (even loosely, e.g. an abbreviation), use the EXACT known spelling. Only introduce a new client name if it clearly is not one of the known clients.`
        : 'If the entry names a client/customer the work is for, extract that name; otherwise use null.',
      'Return this exact JSON structure:',
      '{ "category": "string", "summary": "one sentence summary", "entities": { "amount": number or null, "currency": "string or null", "date": "ISO date string", "sentiment": "positive or neutral or negative", "urgency": "low or medium or high", "client": "string or null", "names": ["array of person or company names"], "tags": ["array of relevant keywords"] } }',
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
      (c: { name: string }) => c.name.toLowerCase() === extracted.category.toLowerCase()
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
      const comparisons = recentLogs.map((l: { raw_content: string }, i: number) => `[${i + 1}] ${l.raw_content}`).join('\n\n');
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

      if (
        similarity.duplicate &&
        Number.isInteger(similarity.source_index) &&
        similarity.source_index >= 1 &&
        similarity.source_index <= recentLogs.length
      ) {
        isConflict = true;
        conflictSourceId = (recentLogs as any)[similarity.source_index - 1].id;
        conflictReason = typeof similarity.reason === 'string' ? similarity.reason.slice(0, 500) : null;
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
  } catch (error) {
    console.error('api/process error:', error);
    if (error instanceof Error && /required|too long/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
