import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { blockType, layoutValidator, queryConfigValidator } from './schema';
import { requireUserId, optionalUserId } from './lib/identity';
import { defaultLayoutFor, nextFreeRow, packGrid, MIN_W, MIN_H } from './lib/layout';

type Starter = { type: 'metric' | 'chart' | 'list' | 'timeline' | 'summary' | 'source_log'; title: string; category?: string };

// Spec §6 starter-canvas mapping. Each work type yields a fixed set of blocks,
// each backed by a category so it fills with real data as the user logs.
const STARTER_CANVAS: Record<string, Starter[]> = {
  consultant_freelancer: [
    { type: 'list', title: 'Client Updates', category: 'Clients' },
    { type: 'list', title: 'Open Tasks', category: 'Tasks' },
    { type: 'timeline', title: 'Project Progress', category: 'Projects' },
    { type: 'chart', title: 'Expenses', category: 'Finance' },
    { type: 'summary', title: 'Weekly Summary' },
  ],
  small_business: [
    { type: 'list', title: 'Daily Operations', category: 'Operations' },
    { type: 'chart', title: 'Expenses', category: 'Finance' },
    { type: 'metric', title: 'Sales / Revenue', category: 'Finance' },
    { type: 'list', title: 'Inventory Notes', category: 'Operations' },
    { type: 'list', title: 'Issues / Risks', category: 'Operations' },
    { type: 'summary', title: 'Weekly Summary' },
  ],
  creative: [
    { type: 'timeline', title: 'Active Projects', category: 'Projects' },
    { type: 'list', title: 'Deliverables', category: 'Projects' },
    { type: 'list', title: 'Client Feedback', category: 'Clients' },
    { type: 'chart', title: 'Expenses', category: 'Finance' },
    { type: 'list', title: 'Risks / Blockers', category: 'Projects' },
    { type: 'summary', title: 'Weekly Summary' },
  ],
  marketing_agency: [
    { type: 'list', title: 'Campaign Updates', category: 'Marketing' },
    { type: 'list', title: 'Client Feedback', category: 'Clients' },
    { type: 'list', title: 'Deliverables', category: 'Projects' },
    { type: 'list', title: 'Content Tasks', category: 'Tasks' },
    { type: 'metric', title: 'Performance Notes', category: 'Marketing' },
    { type: 'summary', title: 'Weekly Report Summary' },
  ],
  online_seller: [
    { type: 'list', title: 'Sales Notes', category: 'Finance' },
    { type: 'list', title: 'Inventory Updates', category: 'Operations' },
    { type: 'list', title: 'Customer Feedback', category: 'Clients' },
    { type: 'chart', title: 'Marketing Expenses', category: 'Marketing' },
    { type: 'list', title: 'Operational Issues', category: 'Operations' },
    { type: 'summary', title: 'Weekly Summary' },
  ],
  other: [
    { type: 'list', title: 'Tasks', category: 'Tasks' },
    { type: 'list', title: 'Notes', category: 'Other' },
    { type: 'chart', title: 'Expenses', category: 'Finance' },
    { type: 'summary', title: 'Weekly Summary' },
  ],
};

// How long a soft-deleted block lingers before hard purge (spec §4: 5s undo).
// Kept generously above the client toast window to avoid races.
const UNDO_WINDOW_MS = 10_000;

async function listUserBlocks(ctx: any, userId: string) {
  return ctx.db
    .query('canvasBlocks')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .collect();
}

async function ownedBlock(ctx: any, userId: string, id: any) {
  const block = await ctx.db.get(id);
  if (!block || block.userId !== userId) throw new Error('Block not found');
  return block;
}

// Reactive canvas feed (spec §7). Excludes tombstoned blocks.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const blocks = await listUserBlocks(ctx, userId);
    return blocks.filter((b: any) => !b.deletedAt);
  },
});

export const create = mutation({
  args: {
    type: blockType,
    title: v.string(),
    queryConfig: v.optional(queryConfigValidator),
    layout: v.optional(layoutValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await listUserBlocks(ctx, userId);
    const layout = args.layout ?? defaultLayoutFor(args.type, nextFreeRow(existing));
    return ctx.db.insert('canvasBlocks', {
      userId,
      type: args.type,
      title: args.title.trim().slice(0, 80),
      queryConfig: args.queryConfig ?? {},
      layout,
      visible: true,
      pinned: false,
      includeInReports: true,
      createdAt: Date.now(),
      deletedAt: null,
    });
  },
});

// Seeds the onboarding starter canvas for a declared work type (spec §6).
// No-ops if the user already has blocks, so it is safe to call more than once.
export const seedStarter = mutation({
  args: { workType: v.string() },
  handler: async (ctx, { workType }) => {
    const userId = await requireUserId(ctx);
    const existing = await listUserBlocks(ctx, userId);
    if (existing.some((b: any) => !b.deletedAt)) return { seeded: 0 };

    const starters = STARTER_CANVAS[workType] ?? STARTER_CANVAS.other;
    const layouts = packGrid(starters.map((s) => s.type));
    const now = Date.now();
    for (let i = 0; i < starters.length; i++) {
      const s = starters[i];
      await ctx.db.insert('canvasBlocks', {
        userId,
        type: s.type,
        title: s.title,
        queryConfig: s.category ? { category: s.category } : {},
        layout: layouts[i],
        visible: true,
        pinned: false,
        includeInReports: true,
        createdAt: now,
        deletedAt: null,
      });
    }
    return { seeded: starters.length };
  },
});

// Persisted on gesture-end (resolves spec §11 Q5 — no per-frame writes).
// Accepts a batch so a single drag settling multiple blocks is one round-trip.
export const updateLayout = mutation({
  args: {
    updates: v.array(v.object({ id: v.id('canvasBlocks'), layout: layoutValidator })),
  },
  handler: async (ctx, { updates }) => {
    const userId = await requireUserId(ctx);
    for (const { id, layout } of updates) {
      const block = await ownedBlock(ctx, userId, id);
      if (block.pinned) continue; // pin locks position/size (spec §4)
      await ctx.db.patch(id, {
        layout: { ...layout, w: Math.max(MIN_W, layout.w), h: Math.max(MIN_H, layout.h) },
      });
    }
  },
});

export const rename = mutation({
  args: { id: v.id('canvasBlocks'), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    const clean = title.trim().slice(0, 80);
    if (!clean) throw new Error('Title required');
    await ctx.db.patch(id, { title: clean });
  },
});

// Hide — retains data and config (spec §4: distinct from delete).
export const setVisible = mutation({
  args: { id: v.id('canvasBlocks'), visible: v.boolean() },
  handler: async (ctx, { id, visible }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { visible });
  },
});

export const setPinned = mutation({
  args: { id: v.id('canvasBlocks'), pinned: v.boolean() },
  handler: async (ctx, { id, pinned }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { pinned });
  },
});

export const toggleReport = mutation({
  args: { id: v.id('canvasBlocks'), includeInReports: v.boolean() },
  handler: async (ctx, { id, includeInReports }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { includeInReports });
  },
});

export const updateQueryConfig = mutation({
  args: { id: v.id('canvasBlocks'), queryConfig: queryConfigValidator },
  handler: async (ctx, { id, queryConfig }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { queryConfig });
  },
});

// Duplicate — independent layout AND queryConfig (resolves spec §11 Q2).
export const duplicate = mutation({
  args: { id: v.id('canvasBlocks') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const src = await ownedBlock(ctx, userId, id);
    const existing = await listUserBlocks(ctx, userId);
    return ctx.db.insert('canvasBlocks', {
      userId,
      type: src.type,
      title: `${src.title} (copy)`.slice(0, 80),
      queryConfig: { ...src.queryConfig },
      layout: defaultLayoutFor(src.type, nextFreeRow(existing)),
      visible: true,
      pinned: false,
      includeInReports: src.includeInReports,
      createdAt: Date.now(),
      deletedAt: null,
    });
  },
});

// Soft delete — deferred hard removal enables the 5s undo toast (spec §4).
export const softDelete = mutation({
  args: { id: v.id('canvasBlocks') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { deletedAt: Date.now() });
  },
});

export const restore = mutation({
  args: { id: v.id('canvasBlocks') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await ownedBlock(ctx, userId, id);
    await ctx.db.patch(id, { deletedAt: null });
  },
});

// Hard-purges tombstones past the undo window. Scheduled from crons.ts.
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - UNDO_WINDOW_MS;
    const stale = await ctx.db
      .query('canvasBlocks')
      .filter((q) =>
        q.and(q.neq(q.field('deletedAt'), null), q.lt(q.field('deletedAt'), cutoff)),
      )
      .collect();
    for (const b of stale) await ctx.db.delete(b._id);
  },
});
