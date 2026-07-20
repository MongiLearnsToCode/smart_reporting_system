/**
 * One-time Supabase -> Convex migration (Phase 7).
 *
 * Copies existing `logs` and `widgets` into Convex `logs` / `canvasBlocks`.
 * Idempotent: logs skip on matching sourceId, blocks skip on matching title.
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   NEXT_PUBLIC_CONVEX_URL, MIGRATION_SECRET (also set in Convex dashboard).
 *
 * Run: npx tsx scripts/migrate-to-convex.ts
 */
import { createClient } from '@supabase/supabase-js';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;
const SECRET = process.env.MIGRATION_SECRET!;

const ENTITY_FIELDS = [
  'type', 'category', 'date', 'date_reference', 'amount', 'currency', 'client',
  'project', 'task', 'status', 'issue_or_risk', 'deliverable', 'sentiment',
  'urgency', 'confidence', 'corrections', 'names', 'tags',
] as const;

// Keep only fields the strict Convex entityValidator accepts.
function sanitizeEntity(e: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ENTITY_FIELDS) if (e[k] !== undefined) out[k] = e[k];
  return out;
}

const toMs = (t: string | null) => (t ? new Date(t).getTime() : Date.now());
const validStatus = (s: unknown) =>
  s === 'pending' || s === 'processed' || s === 'needs_review' || s === 'failed'
    ? s : 'processed';
const validBlockType = (t: unknown) =>
  t === 'metric' || t === 'chart' || t === 'list' || t === 'timeline'
    || t === 'summary' || t === 'source_log' ? t : 'metric';

async function main() {
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_CONVEX_URL', 'MIGRATION_SECRET']) {
    if (!process.env[name]) throw new Error(`Missing env ${name}`);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const convex = new ConvexHttpClient(CONVEX_URL);

  // --- Logs ---
  let logCount = 0;
  const { data: logs, error: logErr } = await sb.from('logs').select('*');
  if (logErr) throw logErr;
  for (const l of logs ?? []) {
    const entities = Array.isArray(l.entities) ? l.entities.map(sanitizeEntity) : [];
    await convex.mutation(api.migrate.importLog, {
      secret: SECRET,
      userId: l.user_id,
      sourceId: l.id,
      rawContent: l.raw_content,
      type: l.type ?? null,
      fileUrl: l.file_url ?? null,
      category: l.category ?? null,
      entities,
      aiConfidence: l.ai_confidence ?? null,
      processingStatus: validStatus(l.processing_status),
      excludedFromReports: !!l.excluded_from_reports,
      isConflict: !!l.is_conflict,
      conflictSourceId: l.conflict_source_id ?? null,
      conflictReason: l.conflict_reason ?? null,
      timestamp: toMs(l.timestamp),
    });
    logCount++;
  }
  console.log(`Imported ${logCount} logs`);

  // --- Widgets -> canvasBlocks ---
  let blockCount = 0;
  const { data: widgets, error: wErr } = await sb.from('widgets').select('*');
  if (wErr) throw wErr;
  for (const w of widgets ?? []) {
    const cfg = (w.config ?? {}) as Record<string, number | string>;
    await convex.mutation(api.migrate.importBlock, {
      secret: SECRET,
      userId: w.user_id,
      type: validBlockType(w.type),
      title: w.title,
      queryConfig: { category: typeof cfg.category === 'string' ? cfg.category : undefined },
      layout: {
        x: Number(cfg.x ?? 0),
        y: Number(cfg.y ?? 0),
        w: Number(cfg.w ?? 4),
        h: Number(cfg.h ?? 3),
      },
      includeInReports: true,
    });
    blockCount++;
  }
  console.log(`Imported ${blockCount} blocks`);
  console.log('Migration complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
