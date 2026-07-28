import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireUserId } from './lib/identity';

// Shared exchange-rate cache. The rows are reference data rather than user
// data — a rate is a fact about a pair on a date, identical for everyone — so
// these are gated on being signed in but not scoped to a user. That sharing is
// the point: backfilling a year of logs after a currency change reuses rates
// already fetched instead of making a request per entry.

/** Rates for a batch of cache keys. Batched because a backfill wants months at once. */
export const lookup = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    await requireUserId(ctx);
    const out: Record<string, { rate: number; date: string; source: string }> = {};
    // Bounded by the caller; the backfill chunks its keys.
    for (const key of keys.slice(0, 200)) {
      const row = await ctx.db
        .query('fxRates')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first();
      if (row) out[key] = { rate: row.rate, date: row.date, source: row.source };
    }
    return out;
  },
});

export const store = mutation({
  args: {
    rates: v.array(
      v.object({
        key: v.string(),
        from: v.string(),
        to: v.string(),
        date: v.string(),
        rate: v.number(),
        source: v.string(),
      }),
    ),
  },
  handler: async (ctx, { rates }) => {
    await requireUserId(ctx);
    for (const r of rates.slice(0, 200)) {
      if (!Number.isFinite(r.rate) || r.rate <= 0) continue;
      const existing = await ctx.db
        .query('fxRates')
        .withIndex('by_key', (q) => q.eq('key', r.key))
        .first();
      // First write wins. A settled rate does not change, and refusing to
      // overwrite means a provider having a bad day can't corrupt a good row.
      if (existing) continue;
      await ctx.db.insert('fxRates', { ...r, fetchedAt: Date.now() });
    }
  },
});
