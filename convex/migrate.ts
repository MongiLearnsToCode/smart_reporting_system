import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { entityValidator, layoutValidator, queryConfigValidator, blockType } from './schema';

// One-time Supabase -> Convex import (Phase 7). These run without a user JWT
// (the migration script has no session), so they are guarded by a shared secret
// checked against the MIGRATION_SECRET Convex env var. Remove after migrating.
function assertSecret(secret: string) {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) throw new Error('Bad migration secret');
}

export const importLog = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    sourceId: v.string(),
    rawContent: v.string(),
    type: v.union(v.string(), v.null()),
    fileUrl: v.union(v.string(), v.null()),
    category: v.union(v.string(), v.null()),
    entities: v.array(entityValidator),
    aiConfidence: v.union(v.number(), v.null()),
    processingStatus: v.union(
      v.literal('pending'), v.literal('processed'),
      v.literal('needs_review'), v.literal('failed'),
    ),
    excludedFromReports: v.boolean(),
    isConflict: v.boolean(),
    conflictSourceId: v.union(v.string(), v.null()),
    conflictReason: v.union(v.string(), v.null()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const dup = await ctx.db
      .query('logs')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .first();
    if (dup) return dup._id; // idempotent
    const { secret, ...fields } = args;
    return ctx.db.insert('logs', fields);
  },
});

export const importBlock = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    type: blockType,
    title: v.string(),
    queryConfig: queryConfigValidator,
    layout: layoutValidator,
    includeInReports: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query('canvasBlocks')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    if (existing.some((b) => !b.deletedAt && b.title === args.title)) {
      return null; // idempotent by title
    }
    const { secret, ...rest } = args;
    return ctx.db.insert('canvasBlocks', {
      ...rest,
      visible: true,
      pinned: false,
      createdAt: Date.now(),
      deletedAt: null,
    });
  },
});
