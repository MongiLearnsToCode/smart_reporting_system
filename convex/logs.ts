import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { entityValidator } from './schema';
import { requireUserId, optionalUserId } from './lib/identity';
import { defaultLayoutFor, nextFreeRow } from './lib/layout';

const processingStatus = v.union(
  v.literal('pending'),
  v.literal('processed'),
  v.literal('needs_review'),
  v.literal('failed'),
);

// Reactive log feed — the source subscription that drives block updates (spec §7).
export const list = query({
  args: { category: v.optional(v.string()), sinceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    let rows;
    if (args.category) {
      rows = await ctx.db
        .query('logs')
        .withIndex('by_user_category', (q) =>
          q.eq('userId', userId).eq('category', args.category),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query('logs')
        .withIndex('by_user_time', (q) => q.eq('userId', userId))
        .order('desc')
        .collect();
    }
    if (args.sinceMs != null) {
      rows = rows.filter((r) => r.timestamp >= args.sinceMs!);
    }
    return rows;
  },
});

// Single log by id (retry path in app/api/process reuses stored raw content).
export const getById = query({
  args: { id: v.id('logs') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const log = await ctx.db.get(id);
    if (!log || log.userId !== userId) return null;
    return log;
  },
});

// Distinct recent client names, for prompt consistency (ported from
// app/api/process/route.ts:56-68).
export const knownClients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('logs')
      .withIndex('by_user_time', (q) => q.eq('userId', userId))
      .order('desc')
      .take(100);
    const seen: string[] = [];
    for (const row of rows) {
      for (const e of row.entities) {
        const client = typeof e.client === 'string' ? e.client.trim() : '';
        if (client && !seen.includes(client)) seen.push(client);
      }
    }
    return seen;
  },
});

// Recent logs in a category within a window, for conflict detection
// (ported from app/api/process/route.ts:141-153).
export const recentInCategory = query({
  args: { category: v.string(), sinceMs: v.number(), excludeId: v.optional(v.id('logs')) },
  handler: async (ctx, { category, sinceMs, excludeId }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('logs')
      .withIndex('by_user_category', (q) => q.eq('userId', userId).eq('category', category))
      .collect();
    return rows
      .filter((r) => r.timestamp >= sinceMs && r._id !== excludeId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map((r) => ({ id: r._id, rawContent: r.rawContent }));
  },
});

// Chooses a block type for an auto-created category block (ported from
// app/api/process/route.ts:225-227).
function blockTypeForCategory(category: string): 'metric' | 'chart' | 'list' {
  if (category === 'Finance') return 'chart';
  if (category === 'Tasks') return 'list';
  return 'metric';
}

// Ensures a block exists for a category (spec §6 new-category detection).
async function ensureCategoryBlock(ctx: any, userId: string, category: string) {
  const blocks = await ctx.db
    .query('canvasBlocks')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .collect();
  const has = blocks.some(
    (b: any) => !b.deletedAt && b.queryConfig?.category === category,
  );
  if (has) return;
  const type = blockTypeForCategory(category);
  await ctx.db.insert('canvasBlocks', {
    userId,
    type,
    title: category,
    queryConfig: { category },
    layout: defaultLayoutFor(type, nextFreeRow(blocks)),
    visible: true,
    pinned: false,
    includeInReports: true,
    createdAt: Date.now(),
    deletedAt: null,
  });
}

// Writes a processed log and fires block creation for new categories (spec §6, §7).
// Called from app/api/process after Groq extraction, authenticated as the user.
// Pass `logId` to overwrite an existing row (the retry path).
export const ingest = mutation({
  args: {
    logId: v.optional(v.id('logs')),
    rawContent: v.string(),
    type: v.optional(v.union(v.string(), v.null())),
    fileUrl: v.optional(v.union(v.string(), v.null())),
    category: v.optional(v.union(v.string(), v.null())),
    entities: v.array(entityValidator),
    aiConfidence: v.optional(v.union(v.number(), v.null())),
    processingStatus,
    isConflict: v.optional(v.boolean()),
    conflictSourceId: v.optional(v.union(v.string(), v.null())),
    conflictReason: v.optional(v.union(v.string(), v.null())),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { logId, ...rest } = args;
    const fields = {
      userId,
      rawContent: rest.rawContent,
      type: rest.type ?? null,
      fileUrl: rest.fileUrl ?? null,
      category: rest.category ?? null,
      entities: rest.entities,
      aiConfidence: rest.aiConfidence ?? null,
      processingStatus: rest.processingStatus,
      excludedFromReports: false,
      isConflict: rest.isConflict ?? false,
      conflictSourceId: rest.conflictSourceId ?? null,
      conflictReason: rest.conflictReason ?? null,
      timestamp: rest.timestamp ?? Date.now(),
    };

    let id;
    if (logId) {
      const existing = await ctx.db.get(logId);
      if (!existing || existing.userId !== userId) throw new Error('Log not found');
      await ctx.db.patch(logId, fields);
      id = logId;
    } else {
      id = await ctx.db.insert('logs', fields);
    }

    if (rest.category && rest.processingStatus !== 'failed') {
      await ensureCategoryBlock(ctx, userId, rest.category);
    }
    return id;
  },
});

// Apply a user correction from the Original Log Modal (spec §8). Immutable,
// append-only audit trail; derived blocks refresh reactively.
export const applyCorrection = mutation({
  args: {
    id: v.id('logs'),
    field: v.string(),
    to: v.optional(v.union(v.string(), v.number(), v.null())),
    entities: v.optional(v.array(entityValidator)),
    category: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const log = await ctx.db.get(args.id);
    if (!log || log.userId !== userId) throw new Error('Log not found');

    const prior =
      args.field === 'category' ? log.category : undefined;
    const corrections = [
      ...(log.corrections ?? []),
      { field: args.field, from: prior ?? null, to: args.to ?? null, at: Date.now() },
    ];
    const patch: Record<string, unknown> = { corrections };
    if (args.entities) patch.entities = args.entities;
    if (args.category !== undefined) patch.category = args.category;
    await ctx.db.patch(args.id, patch);

    if (args.category) await ensureCategoryBlock(ctx, userId, args.category);
  },
});

// Permanently remove a log (conflict "revert" action in the dashboard).
export const remove = mutation({
  args: { id: v.id('logs') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const log = await ctx.db.get(id);
    if (!log || log.userId !== userId) throw new Error('Log not found');
    await ctx.db.delete(id);
  },
});

// Exclude a log from reports / block aggregation (spec §8).
export const setExcluded = mutation({
  args: { id: v.id('logs'), excluded: v.boolean() },
  handler: async (ctx, { id, excluded }) => {
    const userId = await requireUserId(ctx);
    const log = await ctx.db.get(id);
    if (!log || log.userId !== userId) throw new Error('Log not found');
    await ctx.db.patch(id, { excludedFromReports: excluded });
  },
});
