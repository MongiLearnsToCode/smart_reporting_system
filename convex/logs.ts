import { mutation, query, type MutationCtx } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { entityValidator } from './schema';
import type { Doc } from './_generated/dataModel';
import { requireUserId, optionalUserId } from './lib/identity';
import { defaultLayoutFor, nextFreeRow } from './lib/layout';

const processingStatus = v.union(
  v.literal('pending'),
  v.literal('processed'),
  v.literal('needs_review'),
  v.literal('failed'),
);

// Reactive log feed — the source subscription that drives block updates (spec §7).
// `projectId` narrows the feed to one project's entries; omitting it returns
// everything, which is what the "Entire business" scope shows.
export const list = query({
  args: {
    category: v.optional(v.string()),
    sinceMs: v.optional(v.number()),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    let rows;
    if (args.projectId) {
      rows = await ctx.db
        .query('logs')
        .withIndex('by_user_project', (q) =>
          q.eq('userId', userId).eq('projectId', args.projectId),
        )
        .take(500);
      if (args.category) rows = rows.filter((r) => r.category === args.category);
      rows.sort((a, b) => b.timestamp - a.timestamp);
    } else if (args.category) {
      rows = await ctx.db
        .query('logs')
        .withIndex('by_user_category', (q) =>
          q.eq('userId', userId).eq('category', args.category),
        )
        .take(500);
    } else {
      rows = await ctx.db
        .query('logs')
        .withIndex('by_user_time', (q) => q.eq('userId', userId))
        .order('desc')
        .take(500);
    }
    if (args.sinceMs != null) {
      rows = rows.filter((r) => r.timestamp >= args.sinceMs!);
    }
    return rows;
  },
});

// The activity feed is intentionally independent of the canvas subscription:
// it grows on demand instead of asking every open dashboard to hold a user's
// full history in memory.
export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    if (args.projectId && args.category) {
      return await ctx.db
        .query('logs')
        .withIndex('by_user_category_project_timestamp', (q) =>
          q.eq('userId', userId).eq('category', args.category!).eq('projectId', args.projectId!),
        )
        .order('desc')
        .paginate(args.paginationOpts);
    }
    if (args.projectId) {
      return await ctx.db
        .query('logs')
        .withIndex('by_user_project_timestamp', (q) =>
          q.eq('userId', userId).eq('projectId', args.projectId!),
        )
        .order('desc')
        .paginate(args.paginationOpts);
    }
    if (args.category) {
      return await ctx.db
        .query('logs')
        .withIndex('by_user_category_timestamp', (q) =>
          q.eq('userId', userId).eq('category', args.category!),
        )
        .order('desc')
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query('logs')
      .withIndex('by_user_time', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate(args.paginationOpts);
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
// Comparison is confined to the entry's own scope: a project update and a
// business-wide note aren't duplicates of each other even when they read alike.
export const recentInCategory = query({
  args: {
    category: v.string(),
    sinceMs: v.number(),
    excludeId: v.optional(v.id('logs')),
    projectId: v.optional(v.union(v.id('projects'), v.null())),
  },
  handler: async (ctx, { category, sinceMs, excludeId, projectId }) => {
    const userId = await requireUserId(ctx);
    const scope = projectId ?? null;
    const rows = await ctx.db
      .query('logs')
      .withIndex('by_user_category_project_timestamp', (q) =>
        q.eq('userId', userId).eq('category', category).eq('projectId', scope).gte('timestamp', sinceMs),
      )
      .order('desc')
      .take(6);
    return rows
      .filter((r) => r._id !== excludeId)
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
async function ensureCategoryBlock(ctx: MutationCtx, userId: string, category: string) {
  const blocks = await ctx.db
    .query('canvasBlocks')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(200);
  const has = blocks.some(
    (b: Doc<'canvasBlocks'>) => !b.deletedAt && b.queryConfig?.category === category,
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
    // Entry scope chosen in the composer. Absent/null = the whole business.
    projectId: v.optional(v.union(v.id('projects'), v.null())),
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

    // Reject a scope the caller doesn't own rather than silently filing the
    // entry under the wrong project.
    let projectId = rest.projectId ?? null;
    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.userId !== userId) throw new Error('Project not found');
    }

    const fields = {
      userId,
      projectId,
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

// Reassign an already-filed entry to a different project (or back to the whole
// business). Recorded in the same append-only corrections trail as field edits.
export const setProject = mutation({
  args: { id: v.id('logs'), projectId: v.union(v.id('projects'), v.null()) },
  handler: async (ctx, { id, projectId }) => {
    const userId = await requireUserId(ctx);
    const log = await ctx.db.get(id);
    if (!log || log.userId !== userId) throw new Error('Log not found');

    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.userId !== userId) throw new Error('Project not found');
    }
    if ((log.projectId ?? null) === projectId) return;

    await ctx.db.patch(id, {
      projectId,
      corrections: [
        ...(log.corrections ?? []),
        { field: 'projectId', from: log.projectId ?? null, to: projectId, at: Date.now() },
      ],
    });
  },
});

// Full-text search over the user's own entries.
//
// Server-side rather than a client filter over the loaded list: the feed holds
// every log in memory today, but that stops being true in the low thousands,
// and search is the feature that would break first and most confusingly. The
// index is authoritative from the start so behaviour doesn't change under the
// user later.
export const search = query({
  args: {
    query: v.string(),
    projectId: v.optional(v.id('projects')),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const text = args.query.trim();
    // A blank search is not a search. Returning everything here would make the
    // empty input look like a filter that had silently applied.
    if (!text) return [];

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return await ctx.db
      .query('logs')
      .withSearchIndex('search_content', (q) => {
        let s = q.search('rawContent', text).eq('userId', userId);
        // Only narrow by project when viewing one. Business-wide means every
        // scope, including entries written before projects existed.
        if (args.projectId !== undefined) s = s.eq('projectId', args.projectId);
        if (args.category !== undefined) s = s.eq('category', args.category);
        return s;
      })
      .take(limit);
  },
});

// Rewrites the converted-currency fields on a batch of logs. Used only by the
// currency-change backfill: the user picked a new default, so every stored
// conversion now targets the wrong currency and has to be recomputed from the
// originals. Amounts and currencies as the user stated them are untouched —
// the backfill recomputes from them, never over them.
export const reconvert = mutation({
  args: {
    updates: v.array(v.object({ id: v.id('logs'), entities: v.array(entityValidator) })),
  },
  handler: async (ctx, { updates }) => {
    const userId = await requireUserId(ctx);
    let written = 0;
    for (const { id, entities } of updates.slice(0, 200)) {
      const log = await ctx.db.get(id);
      if (!log || log.userId !== userId) continue;
      // The caller re-derived these from this log's own entities; a length
      // mismatch means it was working from a stale read, so skip rather than
      // write entities that may not correspond to this log at all.
      if (log.entities.length !== entities.length) continue;
      await ctx.db.patch(id, { entities });
      written++;
    }
    return written;
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
