import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUserId, optionalUserId } from './lib/identity';

// Client uploads the rendered PDF straight to Convex file storage. This short-
// lived URL is the upload target (standard Convex file-upload flow, spec §9).
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

// Records a generated report. Stores block *ids*, never their content, so a
// later regeneration reflects each block's current state (spec §9). Any id that
// no longer resolves to one of the caller's live blocks is dropped here too, so
// the persisted set can't dangle from the moment it's written.
export const create = mutation({
  args: {
    storageId: v.id('_storage'),
    includedBlockIds: v.array(v.id('canvasBlocks')),
    range: v.number(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const owned: (typeof args.includedBlockIds)[number][] = [];
    for (const id of args.includedBlockIds) {
      const block = await ctx.db.get(id);
      if (block && block.userId === userId && !block.deletedAt) owned.push(id);
    }

    return ctx.db.insert('reports', {
      userId,
      storageId: args.storageId,
      includedBlockIds: owned,
      range: args.range,
      title: args.title,
      createdAt: Date.now(),
    });
  },
});

// Reactive past-reports list. Resolves each stored PDF to a stable download URL
// and reports how many of its blocks still exist, so the UI can flag reports
// whose sources have since changed (spec §9 dangling-reference behaviour).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];

    const docs = await ctx.db
      .query('reports')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    docs.sort((a, b) => b.createdAt - a.createdAt);

    return Promise.all(
      docs.map(async (r) => {
        let liveBlocks = 0;
        for (const id of r.includedBlockIds) {
          const block = await ctx.db.get(id);
          if (block && !block.deletedAt) liveBlocks++;
        }
        return {
          _id: r._id,
          title: r.title ?? null,
          range: r.range,
          createdAt: r.createdAt,
          url: await ctx.storage.getUrl(r.storageId),
          includedBlockIds: r.includedBlockIds as string[],
          blockCount: r.includedBlockIds.length,
          liveBlocks,
        };
      }),
    );
  },
});

// Removes a report and its stored PDF. Owner-scoped.
export const remove = mutation({
  args: { id: v.id('reports') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const report = await ctx.db.get(id);
    if (!report || report.userId !== userId) throw new Error('Report not found');
    await ctx.storage.delete(report.storageId);
    await ctx.db.delete(id);
  },
});
