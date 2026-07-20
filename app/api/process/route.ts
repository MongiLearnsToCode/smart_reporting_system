import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson, pickExtractionModel } from '@/utils/api/groq';
import { DEFAULT_SETTINGS, parseProcessPayload } from '@/utils/api/validation';
import { normalizeEntities, overallConfidence, primaryCategory, statusFor } from '@/utils/api/entity-normalizer';
import { resolveDateReference } from '@/utils/api/date-reference';
import { CATEGORIES } from '@/lib/categories';
import { ENTITY_TYPES, type LogEntity } from '@/lib/dashboard-utils';
import { convexForUser } from '@/utils/convex/serverClient';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`process:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Convex is the log/block store; authenticate it as this user (spec §7).
    const convex = convexForUser(session.access_token);
    const parsed = parseProcessPayload(await request.json());

    // Retry path: reuse the stored raw content and overwrite the same Convex doc.
    let { rawContent, type, fileUrl } = parsed;
    let retryLogId: string | null = null;
    if (parsed.logId) {
      const row = await convex.query(api.logs.getById, { id: parsed.logId as any });
      if (!row) {
        return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      }
      retryLogId = row._id;
      rawContent = row.rawContent;
      type = row.type === 'file' ? 'file' : 'text';
      fileUrl = row.fileUrl ?? null;
    }

    // Settings live in auth user_metadata; the user_settings table has no grants.
    const stored = user.user_metadata?.settings;
    const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
    const { currency, timezone, ai_language: aiLanguage } = settings;
    const conflictDetection = settings.conflict_detection !== false;
    const conflictDismissDays = settings.conflict_dismiss_days ?? 7;

    const knownClients: string[] = await convex.query(api.logs.knownClients, {});

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
      const logId = await convex.mutation(api.logs.ingest, {
        logId: (retryLogId ?? undefined) as any,
        rawContent,
        type,
        fileUrl: fileUrl ?? null,
        category: 'Other',
        entities: [],
        aiConfidence: null,
        processingStatus: 'failed',
        isConflict: false,
        conflictSourceId: null,
        conflictReason: null,
      });
      return NextResponse.json({ success: true, extractionFailed: true, logId });
    }

    // Deterministic date resolution overrides the model's guess when the reference parses.
    entities = entities.map((entity) => {
      const resolved = resolveDateReference(entity.date_reference, submittedAt, timezone);
      return resolved ? { ...entity, date: resolved } : entity;
    });

    const aiConfidence = overallConfidence(entities);
    const category = primaryCategory(entities);
    const processingStatus = statusFor(aiConfidence);

    // Conflict detection: unchanged logic, recent logs now read from Convex.
    let recentLogs: Array<{ id: string; rawContent: string }> = [];
    if (conflictDetection) {
      recentLogs = await convex.query(api.logs.recentInCategory, {
        category,
        sinceMs: Date.now() - conflictDismissDays * 86400000,
        excludeId: (retryLogId ?? undefined) as any,
      });
    }

    let isConflict = false;
    let conflictSourceId: string | null = null;
    let conflictReason: string | null = null;

    if (conflictDetection && recentLogs.length > 0) {
      const comparisons = recentLogs.map((l, i) => `[${i + 1}] ${l.rawContent}`).join('\n\n');
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

    // Single reactive write: persists the log AND auto-creates a category block
    // if none exists (spec §6). Subscribers see the update within the §7 budget.
    const logId = await convex.mutation(api.logs.ingest, {
      logId: (retryLogId ?? undefined) as any,
      rawContent,
      type,
      fileUrl: fileUrl ?? null,
      category,
      entities,
      aiConfidence,
      processingStatus,
      isConflict,
      conflictSourceId,
      conflictReason,
    });

    return NextResponse.json({ success: true, logId });
  } catch (error) {
    console.error('api/process error:', error);
    if (error instanceof Error && /required|too long/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
