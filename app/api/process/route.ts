import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson, pickExtractionModel } from '@/utils/api/groq';
import { DEFAULT_SETTINGS, parseProcessPayload } from '@/utils/api/validation';
import { normalizeEntities, overallConfidence, primaryCategory, statusFor } from '@/utils/api/entity-normalizer';
import { resolveDateReference } from '@/utils/api/date-reference';
import { CATEGORIES } from '@/lib/categories';
import { entitiesOf, ENTITY_TYPES, type Log, type LogEntity } from '@/lib/dashboard-utils';

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
    const parsed = parseProcessPayload(await request.json());
    const userId = user.id;

    // Retry path: reuse the stored raw content and update the same row.
    let { rawContent, type, fileUrl } = parsed;
    let retryLogId: string | null = null;
    if (parsed.logId) {
      const { data: row, error: fetchError } = await admin
        .from('logs')
        .select('id, raw_content, type, file_url')
        .eq('id', parsed.logId)
        .eq('user_id', userId)
        .single();
      if (fetchError || !row) {
        return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      }
      retryLogId = row.id;
      rawContent = row.raw_content;
      type = row.type === 'file' ? 'file' : 'text';
      fileUrl = row.file_url;
    }

    // Settings live in auth user_metadata; the user_settings table has no grants.
    const stored = user.user_metadata?.settings;
    const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
    const { currency, timezone, ai_language: aiLanguage } = settings;
    const conflictDetection = settings.conflict_detection !== false;
    const conflictDismissDays = settings.conflict_dismiss_days ?? 7;

    // Known clients: flatten entity arrays in JS (entities->client stopped
    // working when entities became an array).
    const { data: clientRows } = await admin
      .from('logs')
      .select('category, entities')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    const knownClients: string[] = [];
    for (const row of clientRows ?? []) {
      for (const entity of entitiesOf(row as Log)) {
        const client = typeof entity.client === 'string' ? entity.client.trim() : '';
        if (client && !knownClients.includes(client)) knownClients.push(client);
      }
    }

    const submittedAt = new Date();
    const systemPrompt = [
      'You are an AI data extractor for Codex, a reporting platform for consultants and agencies.',
      'Extract EVERY distinct piece of information from the log entry as separate entity objects. A single entry may contain several updates (an expense AND a task AND a client update) — split them into separate entities.',
      'Return ONLY a valid JSON array with no markdown, no code blocks, and no explanation. Even a single entity must be wrapped in an array.',
      'Each array element must have exactly this shape:',
      `{ "type": "${ENTITY_TYPES.join('|')}",`,
      `  "category": "${CATEGORIES.join('|')}",`,
      '  "date": "YYYY-MM-DD best guess, or null",',
      '  "date_reference": "the verbatim date phrase from the text (e.g. \\"yesterday\\", \\"last Friday\\"), or null",',
      '  "amount": number or null, "currency": "ISO currency code or null",',
      '  "client": "string or null", "project": "string or null",',
      '  "task": "string or null", "status": "open|in_progress|complete|blocked or null",',
      '  "issue_or_risk": "string or null", "deliverable": "string or null",',
      '  "sentiment": "positive|neutral|negative or null", "urgency": "low|medium|high or null",',
      '  "confidence": number between 0 and 1 — how certain you are about THIS entity }',
      `Today's date for resolving relative dates: ${submittedAt.toLocaleString('en-US', { timeZone: timezone })} (timezone: ${timezone})`,
      `Default currency: ${currency}. Use this when no currency is specified.`,
      `Write any free-text fields in ${aiLanguage}.`,
      knownClients.length
        ? `Known clients: ${knownClients.join(', ')}. If the entry refers to one of these (even loosely, e.g. an abbreviation), use the EXACT known spelling. Only introduce a new client name if it clearly is not one of the known clients.`
        : 'If the entry names a client/customer the work is for, extract that name; otherwise use null.',
    ].join('\n');

    let entities: LogEntity[] | null = null;
    try {
      const model = pickExtractionModel(rawContent, type as 'text' | 'file');
      const aiResponse = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawContent },
      ], model);
      entities = normalizeEntities(extractJson(aiResponse));
    } catch (extractionError) {
      console.error('api/process extraction failed:', extractionError);
    }

    // Failure path: save the log anyway so nothing is lost; the feed offers a retry.
    if (!entities) {
      const failedFields = {
        category: 'Other',
        entities: [] as LogEntity[],
        ai_confidence: null,
        processing_status: 'failed',
        is_conflict: false,
        conflict_source_id: null,
        conflict_reason: null,
      };
      const { data: savedLog, error: saveError } = retryLogId
        ? await admin.from('logs').update(failedFields).eq('id', retryLogId).eq('user_id', userId).select().single()
        : await admin.from('logs').insert({
            user_id: userId,
            raw_content: rawContent,
            type,
            file_url: fileUrl ?? null,
            ...failedFields,
          }).select().single();
      if (saveError) throw saveError;
      return NextResponse.json({ success: true, extractionFailed: true, log: savedLog });
    }

    // Deterministic date resolution overrides the model's guess when the reference parses.
    entities = entities.map((entity) => {
      const resolved = resolveDateReference(entity.date_reference, submittedAt, timezone);
      return resolved ? { ...entity, date: resolved } : entity;
    });

    const aiConfidence = overallConfidence(entities);
    const category = primaryCategory(entities);
    const processingStatus = statusFor(aiConfidence);

    // Conflict detection: unchanged, keyed off the primary category.
    const windowStart = new Date(Date.now() - conflictDismissDays * 86400000).toISOString();
    let recentLogs: Array<{ id: string; raw_content: string }> | null = null;
    if (conflictDetection) {
      let recentQuery = admin
        .from('logs')
        .select('id, raw_content')
        .eq('user_id', userId)
        .eq('category', category)
        .gte('timestamp', windowStart)
        .order('timestamp', { ascending: false })
        .limit(5);
      if (retryLogId) recentQuery = recentQuery.neq('id', retryLogId);
      ({ data: recentLogs } = await recentQuery);
    }

    let isConflict = false;
    let conflictSourceId: string | null = null;
    let conflictReason: string | null = null;

    if (conflictDetection && recentLogs && recentLogs.length > 0) {
      const comparisons = recentLogs.map((l, i) => `[${i + 1}] ${l.raw_content}`).join('\n\n');
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

      try {
        const similarityResult = await callGroq([{ role: 'user', content: similarityPrompt }]);
        const similarity = extractJson(similarityResult);
        if (
          similarity.duplicate &&
          Number.isInteger(similarity.source_index) &&
          similarity.source_index >= 1 &&
          similarity.source_index <= recentLogs.length
        ) {
          isConflict = true;
          conflictSourceId = recentLogs[similarity.source_index - 1].id;
          conflictReason = typeof similarity.reason === 'string' ? similarity.reason.slice(0, 500) : null;
        }
      } catch (conflictError) {
        // Extraction succeeded — a conflict-check failure must not fail the log.
        console.error('api/process conflict check failed:', conflictError);
      }
    }

    const logFields = {
      category,
      entities,
      ai_confidence: aiConfidence,
      processing_status: processingStatus,
      is_conflict: isConflict,
      conflict_source_id: conflictSourceId,
      conflict_reason: conflictReason,
    };
    const { data: savedLog, error: insertError } = retryLogId
      ? await admin.from('logs').update(logFields).eq('id', retryLogId).eq('user_id', userId).select().single()
      : await admin.from('logs').insert({
          user_id: userId,
          raw_content: rawContent,
          type,
          file_url: fileUrl ?? null,
          ...logFields,
        }).select().single();

    if (insertError) throw insertError;

    // Ensure a widget exists for the primary category.
    const { data: existingWidgets } = await admin
      .from('widgets')
      .select('id')
      .eq('user_id', userId)
      .contains('config', { category });

    if (!existingWidgets?.length) {
      let widgetType = 'metric';
      if (category === 'Finance') widgetType = 'chart';
      if (category === 'Tasks') widgetType = 'list';

      await admin.from('widgets').insert({
        user_id: userId,
        type: widgetType,
        title: category,
        config: { category, w: 4, h: 2, x: 0, y: 0 },
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
