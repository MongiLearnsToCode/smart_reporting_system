// Re-converts a user's whole log history after they change default currency.
//
// This is the payoff for never overwriting `amount`/`currency`: the originals
// are still there, so switching from USD to ZAR re-derives every figure from
// what the user actually said rather than converting a conversion.
//
// Runs inline on the settings save. It is bounded by the user's own log count,
// most rates come from the shared cache, and each pair/date is fetched at most
// once for the whole run — so a year of history is a handful of requests.

import type { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { LogEntity } from '@/lib/dashboard-utils';
import { normalizeCurrency } from '@/lib/fx';
import { convertEntities } from './fx-apply';

const WRITE_CHUNK = 50;

// Convex's generated entity type is looser than LogEntity (every field
// optional, `type` a bare string), so the read is narrowed at this boundary —
// the same shape normalizeEntities wrote in the first place.
type LogRow = { _id: Id<'logs'>; entities: LogEntity[]; timestamp: number };

/** Drops conversions that pointed at the previous currency, keeping the original. */
function stripConversion(entity: LogEntity): LogEntity {
  const {
    base_amount: _a, base_currency: _c, fx_rate: _r, fx_date: _d, fx_source: _s, ...rest
  } = entity;
  return rest;
}

export async function reconvertAllLogs(
  convex: Pick<ConvexHttpClient, 'query' | 'mutation'>,
  baseCurrency: string,
): Promise<number> {
  const base = normalizeCurrency(baseCurrency);
  if (!base) return 0;

  const logs = (await convex.query(api.logs.list, {})) as unknown as LogRow[];
  const updates: { id: Id<'logs'>; entities: LogEntity[] }[] = [];

  for (const log of logs) {
    if (!log.entities?.length) continue;
    const hasMoney = log.entities.some((e) => typeof e.amount === 'number' && Number.isFinite(e.amount));
    if (!hasMoney) continue;

    const stripped = log.entities.map(stripConversion);
    const { entities } = await convertEntities(convex, stripped, base, new Date(log.timestamp));
    updates.push({ id: log._id, entities });
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    written += await convex.mutation(api.logs.reconvert, {
      updates: updates.slice(i, i + WRITE_CHUNK).map((u) => ({ id: u.id, entities: u.entities })),
    });
  }
  return written;
}
