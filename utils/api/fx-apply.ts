// Converts a batch of entities to the user's default currency, going through
// the shared rate cache before it goes to a provider.
//
// Server-only. Sits between the extractor and the Convex write, and is reused
// verbatim by the currency-change backfill — one code path, so a backfilled
// entry is converted exactly the way a freshly ingested one is.

import type { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { LogEntity } from '@/lib/dashboard-utils';
import { applyQuote, isoDay, needsConversion, normalizeCurrency, rateKey, type FxQuote } from '@/lib/fx';
import { fetchQuote } from './fx';

/** One conversion the batch relied on, for the report's rate footnote. */
export type UsedQuote = { from: string; to: string; rate: number; date: string; source: string };

type Convex = Pick<ConvexHttpClient, 'query' | 'mutation'>;

/**
 * The date to price an entry at: the transaction date the extractor found,
 * falling back to when it was logged. Using the entry's own date is the whole
 * reason for preferring the dated provider — an expense from three weeks ago
 * converts at three-week-old money, not today's.
 */
function priceDate(entity: LogEntity, submittedAt: Date): string {
  return entity.date ? isoDay(entity.date) : isoDay(submittedAt);
}

export async function convertEntities(
  convex: Convex,
  entities: LogEntity[],
  baseCurrency: string,
  submittedAt: Date = new Date(),
): Promise<{ entities: LogEntity[]; quotes: UsedQuote[] }> {
  const base = normalizeCurrency(baseCurrency);
  if (!base) return { entities, quotes: [] };

  // Which pairs/dates this batch actually needs — deduplicated, because a
  // single entry commonly holds several amounts in the same currency.
  const wanted = new Map<string, { from: string; date: string }>();
  for (const entity of entities) {
    if (!needsConversion(entity, base)) continue;
    const from = normalizeCurrency(entity.currency);
    if (!from) continue;
    const date = priceDate(entity, submittedAt);
    wanted.set(rateKey(from, base, date), { from, date });
  }
  if (wanted.size === 0) return { entities, quotes: [] };

  const cached: Record<string, { rate: number; date: string; source: string }> =
    await convex.query(api.fx.lookup, { keys: [...wanted.keys()] }).catch(() => ({}));

  const quotes = new Map<string, FxQuote>();
  const fresh: UsedQuote[] = [];
  for (const [key, { from, date }] of wanted) {
    const hit = cached[key];
    if (hit) {
      quotes.set(key, { rate: hit.rate, rateDate: hit.date, source: hit.source });
      continue;
    }
    const quote = await fetchQuote(from, base, date);
    // A miss is survivable: the entity keeps its original currency and the
    // report shows that currency in its own bucket. Nothing is invented.
    if (!quote) continue;
    quotes.set(key, quote);
    fresh.push({ from, to: base, rate: quote.rate, date: quote.rateDate, source: quote.source });
    // Cache under the key we asked for. Providers roll weekends back to the
    // previous publication day, so quote.rateDate can differ from `date`;
    // keying on the request is what makes the next lookup for that day hit.
    if (from !== base) {
      await convex
        .mutation(api.fx.store, {
          rates: [{ key, from, to: base, date: quote.rateDate, rate: quote.rate, source: quote.source }],
        })
        .catch(() => undefined);
    }
  }

  const used: UsedQuote[] = [...fresh];
  const converted = entities.map((entity) => {
    if (!needsConversion(entity, base)) return entity;
    const from = normalizeCurrency(entity.currency);
    if (!from) return entity;
    const key = rateKey(from, base, priceDate(entity, submittedAt));
    const quote = quotes.get(key);
    if (!quote) return entity;
    const hit = cached[key];
    if (hit) used.push({ from, to: base, rate: hit.rate, date: hit.date, source: hit.source });
    return applyQuote(entity, base, quote);
  });

  return { entities: converted, quotes: used };
}
