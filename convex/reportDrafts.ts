import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { reportSectionValidator } from './schema';
import { requireUserId, optionalUserId } from './lib/identity';

// Draft persistence for the report editor.
//
// A generated report is a first draft; what makes it worth sending is the
// user's own judgement, added by editing. Keeping that in component state
// meant closing the dialog threw it away, which quietly taught people not to
// bother editing at all.

/** The draft for one scope and period, or null if none has been started. */
export const get = query({
  args: {
    projectId: v.optional(v.union(v.id('projects'), v.null())),
    range: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return null;
    const projectId = args.projectId ?? null;
    return await ctx.db
      .query('reportDrafts')
      .withIndex('by_user_scope', (q) =>
        q.eq('userId', userId).eq('projectId', projectId).eq('range', args.range),
      )
      .first();
  },
});

export const save = mutation({
  args: {
    projectId: v.optional(v.union(v.id('projects'), v.null())),
    range: v.number(),
    title: v.string(),
    sections: v.array(reportSectionValidator),
    generated: v.optional(v.array(reportSectionValidator)),
    facts: v.any(),
    comparison: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const projectId = args.projectId ?? null;

    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.userId !== userId) throw new Error('Project not found');
    }

    const existing = await ctx.db
      .query('reportDrafts')
      .withIndex('by_user_scope', (q) =>
        q.eq('userId', userId).eq('projectId', projectId).eq('range', args.range),
      )
      .first();

    const patch = {
      title: args.title.slice(0, 200),
      sections: args.sections,
      // Only replace the pristine copy when a fresh generation supplies one.
      // An autosave of an edit must not overwrite what Reset goes back to.
      ...(args.generated ? { generated: args.generated } : {}),
      facts: args.facts,
      comparison: args.comparison ?? null,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert('reportDrafts', {
      userId,
      projectId,
      range: args.range,
      generated: args.generated ?? args.sections,
      ...patch,
    });
  },
});

export const remove = mutation({
  args: {
    projectId: v.optional(v.union(v.id('projects'), v.null())),
    range: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const projectId = args.projectId ?? null;
    const existing = await ctx.db
      .query('reportDrafts')
      .withIndex('by_user_scope', (q) =>
        q.eq('userId', userId).eq('projectId', projectId).eq('range', args.range),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
