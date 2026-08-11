import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { requireUserId, optionalUserId } from './lib/identity';
import type { Doc, Id } from './_generated/dataModel';

const NAME_MAX = 80;
const DESCRIPTION_MAX = 240;

async function listUserProjects(ctx: QueryCtx | MutationCtx, userId: string): Promise<Doc<'projects'>[]> {
  return ctx.db
    .query('projects')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
}

async function ownedProject(ctx: MutationCtx, userId: string, id: Id<'projects'>): Promise<Doc<'projects'>> {
  const project = await ctx.db.get(id);
  if (!project || project.userId !== userId) throw new Error('Project not found');
  return project;
}

async function prefsRow(ctx: QueryCtx | MutationCtx, userId: string): Promise<Doc<'userPrefs'> | null> {
  return ctx.db
    .query('userPrefs')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

function cleanName(name: string) {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  if (!clean) throw new Error('Project name is required');
  return clean;
}

// Reactive project list, active first then archived, alphabetical within each.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const projects = await listUserProjects(ctx, userId);
    return projects.sort((a, b) => {
      const archived = Number(!!a.archivedAt) - Number(!!b.archivedAt);
      if (archived !== 0) return archived;
      return a.name.localeCompare(b.name);
    });
  },
});

// The user's default entry scope. null = the business as a whole. Returned as
// an object so the client can tell "not loaded yet" from "business-wide".
export const defaultScope = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return { defaultProjectId: null };
    const prefs = await prefsRow(ctx, userId);
    const defaultProjectId = prefs?.defaultProjectId ?? null;
    if (!defaultProjectId) return { defaultProjectId: null };

    // A deleted or archived default silently falls back to business-wide rather
    // than leaving the composer pointing at a scope the user can't see.
    const project = await ctx.db.get(defaultProjectId);
    if (!project || project.userId !== userId || project.archivedAt) {
      return { defaultProjectId: null };
    }
    return { defaultProjectId };
  },
});

export const setDefaultScope = mutation({
  args: { projectId: v.union(v.id('projects'), v.null()) },
  handler: async (ctx, { projectId }) => {
    const userId = await requireUserId(ctx);
    if (projectId) {
      const project = await ownedProject(ctx, userId, projectId);
      if (project.archivedAt) throw new Error('Cannot default to an archived project');
    }
    const prefs = await prefsRow(ctx, userId);
    if (prefs) {
      await ctx.db.patch(prefs._id, { defaultProjectId: projectId, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('userPrefs', {
        userId,
        defaultProjectId: projectId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    // Convenience for the composer's "New project…" flow, which creates a
    // project and immediately makes it the default in one round-trip.
    makeDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = cleanName(args.name);

    const existing = await listUserProjects(ctx, userId);
    const clash = existing.find(
      (p) => !p.archivedAt && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw new Error(`A project called "${clash.name}" already exists`);

    const id = await ctx.db.insert('projects', {
      userId,
      name,
      description: args.description?.trim().slice(0, DESCRIPTION_MAX) || null,
      archivedAt: null,
      createdAt: Date.now(),
    });

    if (args.makeDefault) {
      const prefs = await prefsRow(ctx, userId);
      if (prefs) {
        await ctx.db.patch(prefs._id, { defaultProjectId: id, updatedAt: Date.now() });
      } else {
        await ctx.db.insert('userPrefs', {
          userId,
          defaultProjectId: id,
          updatedAt: Date.now(),
        });
      }
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ownedProject(ctx, userId, args.id);
    const patch: Record<string, unknown> = {};

    if (args.name !== undefined) {
      const name = cleanName(args.name);
      const existing = await listUserProjects(ctx, userId);
      const clash = existing.find(
        (p) => p._id !== args.id && !p.archivedAt && p.name.toLowerCase() === name.toLowerCase(),
      );
      if (clash) throw new Error(`A project called "${clash.name}" already exists`);
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description?.trim().slice(0, DESCRIPTION_MAX) || null;
    }
    if (Object.keys(patch).length) await ctx.db.patch(args.id, patch);
  },
});

// Archiving hides a project from the pickers but leaves its logs attached, so
// history and past reports stay intact.
export const setArchived = mutation({
  args: { id: v.id('projects'), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const userId = await requireUserId(ctx);
    await ownedProject(ctx, userId, id);
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : null });

    if (archived) {
      const prefs = await prefsRow(ctx, userId);
      if (prefs?.defaultProjectId === id) {
        await ctx.db.patch(prefs._id, { defaultProjectId: null, updatedAt: Date.now() });
      }
    }
  },
});

// Deleting a project never deletes its data: every log it held reverts to
// business-wide scope. Destructive to the grouping only.
export const remove = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await ownedProject(ctx, userId, id);

    const logs = await ctx.db
      .query('logs')
      .withIndex('by_user_project', (q) => q.eq('userId', userId).eq('projectId', id))
      .collect();
    for (const log of logs) await ctx.db.patch(log._id, { projectId: null });

    const prefs = await prefsRow(ctx, userId);
    if (prefs?.defaultProjectId === id) {
      await ctx.db.patch(prefs._id, { defaultProjectId: null, updatedAt: Date.now() });
    }

    await ctx.db.delete(id);
    return { reassignedLogs: logs.length };
  },
});
