import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Grid-coordinate layout for a block (spec §3 — React Grid Layout shape).
export const layoutValidator = v.object({
  x: v.number(),
  y: v.number(),
  w: v.number(),
  h: v.number(),
});

// A block's data-fetch logic — what makes a block "adaptive" (spec §3, resolves §11 Q1).
// All fields optional; each block type reads the subset it needs.
export const queryConfigValidator = v.object({
  category: v.optional(v.string()),
  clientFilter: v.optional(v.string()),
  // dateRange is either a rolling window ({ days }) or an explicit span ({ from, to }).
  dateRange: v.optional(
    v.object({
      days: v.optional(v.number()),
      from: v.optional(v.string()),
      to: v.optional(v.string()),
    }),
  ),
  aggregation: v.optional(
    v.union(
      v.literal('sum'),
      v.literal('count'),
      v.literal('avg'),
      v.literal('latest'),
    ),
  ),
  groupBy: v.optional(v.string()),
  sort: v.optional(v.string()),
});

const ns = v.union(v.string(), v.null());
const nn = v.union(v.number(), v.null());

// A single extracted entity — matches LogEntity in lib/dashboard-utils.ts exactly
// (the shape produced by utils/api/entity-normalizer). Convex objects are strict,
// so every field the normalizer can emit must be listed.
export const entityValidator = v.object({
  type: v.optional(v.string()),
  category: v.optional(v.string()),
  date: v.optional(ns),
  date_reference: v.optional(ns),
  amount: v.optional(nn),
  currency: v.optional(ns),
  client: v.optional(ns),
  project: v.optional(ns),
  task: v.optional(ns),
  status: v.optional(ns),
  issue_or_risk: v.optional(ns),
  deliverable: v.optional(ns),
  sentiment: v.optional(ns),
  urgency: v.optional(ns),
  confidence: v.optional(v.number()),
  // Per-entity correction map — LLM/normalizer output; shape varies, kept loose.
  corrections: v.optional(v.any()),
  names: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
});

export const blockType = v.union(
  v.literal('metric'),
  v.literal('chart'),
  v.literal('list'),
  v.literal('timeline'),
  v.literal('summary'),
  v.literal('source_log'),
);

export default defineSchema({
  // Adaptive Canvas Blocks (spec §3). userId = Supabase auth subject (JWT `sub`).
  canvasBlocks: defineTable({
    userId: v.string(),
    type: blockType,
    title: v.string(),
    queryConfig: queryConfigValidator,
    layout: layoutValidator,
    visible: v.boolean(),
    pinned: v.boolean(),
    includeInReports: v.boolean(),
    createdAt: v.number(),
    // Soft-delete tombstone for the 5s undo window (spec §4). null/absent = live.
    deletedAt: v.optional(v.union(v.number(), v.null())),
  }).index('by_user', ['userId']),

  // Structured logs — the source data blocks query over (mirrors Supabase `logs`).
  logs: defineTable({
    userId: v.string(),
    rawContent: v.string(),
    type: v.optional(v.union(v.string(), v.null())),
    fileUrl: v.optional(v.union(v.string(), v.null())),
    category: v.optional(v.union(v.string(), v.null())),
    entities: v.array(entityValidator),
    aiConfidence: v.optional(v.union(v.number(), v.null())),
    processingStatus: v.union(
      v.literal('pending'),
      v.literal('processed'),
      v.literal('needs_review'),
      v.literal('failed'),
    ),
    excludedFromReports: v.boolean(),
    isConflict: v.optional(v.boolean()),
    conflictSourceId: v.optional(v.union(v.string(), v.null())),
    conflictReason: v.optional(v.union(v.string(), v.null())),
    // Per-field user corrections applied via the Original Log Modal (spec §8).
    corrections: v.optional(v.array(v.object({
      field: v.string(),
      from: v.optional(v.union(v.string(), v.number(), v.null())),
      to: v.optional(v.union(v.string(), v.number(), v.null())),
      at: v.number(),
    }))),
    timestamp: v.number(),
    // Original Supabase row id, for idempotent migration (Phase 7).
    sourceId: v.optional(v.string()),
  })
    .index('by_user_time', ['userId', 'timestamp'])
    .index('by_user_category', ['userId', 'category'])
    .index('by_source', ['sourceId']),

  // Generated reports reference blocks by id, never copy content (spec §9).
  reports: defineTable({
    userId: v.string(),
    includedBlockIds: v.array(v.id('canvasBlocks')),
    range: v.number(),
    template: v.optional(v.string()),
    fileUrl: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
  }).index('by_user', ['userId']),
});
