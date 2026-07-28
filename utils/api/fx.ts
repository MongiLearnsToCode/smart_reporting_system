// Rate providers. Server-only — these make outbound HTTP calls.
//
// Two providers, chosen by what each can actually answer:
//
// - Frankfurter serves ECB reference rates and can answer for a *past date*,
//   so an expense logged three weeks ago converts at the rate that applied
//   then. This is the accurate path and covers 12 of the 15 currencies the
//   app offers.
// - open.er-api.com covers NGN, KES and GHS — currencies the ECB doesn't
//   publish and a large part of this product's audience actually uses — but
//   only at the latest rate. The quote carries the rate's real date, so a
//   report footnote discloses it rather than implying a historical figure.
//
// Every failure path returns null. A missing rate leaves the original currency
// intact, which is a worse-looking report and a correct one.

import { ECB_CURRENCIES, isEcbPair, isoDay, normalizeCurrency, type FxQuote } from '@/lib/fx';

const FRANKFURTER = 'https://api.frankfurter.dev/v1';
const ER_API = 'https://open.er-api.com/v6/latest';
const TIMEOUT_MS = 6000;

export const FX_SOURCE_ECB = 'ECB (frankfurter.dev)';
export const FX_SOURCE_ERAPI = 'exchangerate-api.com';

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function validRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** ECB rates for a given past date. Null for non-ECB pairs or any failure. */
async function fromFrankfurter(from: string, to: string, date: string): Promise<FxQuote | null> {
  if (!isEcbPair(from, to)) return null;
  const data = await getJson(`${FRANKFURTER}/${date}?base=${from}&symbols=${to}`);
  const rate = data?.rates?.[to];
  if (!validRate(rate)) return null;
  // Frankfurter answers a weekend or holiday with the previous publication
  // day and says so in `date`. Record what it returned, not what we asked for.
  return { rate, rateDate: typeof data.date === 'string' ? data.date : date, source: FX_SOURCE_ECB };
}

/** Latest rates, broad currency coverage. The quote's date is today's publication. */
async function fromErApi(from: string, to: string): Promise<FxQuote | null> {
  const data = await getJson(`${ER_API}/${from}`);
  const rate = data?.rates?.[to];
  if (!validRate(rate)) return null;
  const stamp = typeof data.time_last_update_unix === 'number'
    ? isoDay(data.time_last_update_unix * 1000)
    : isoDay(new Date());
  return { rate, rateDate: stamp, source: FX_SOURCE_ERAPI };
}

/**
 * A rate for one pair on one date, or null if neither provider could answer.
 *
 * Falls through to the latest-rate provider when the dated one has nothing —
 * including for ECB pairs, where a date before the ECB series begins or a
 * provider outage would otherwise lose the entry's amount entirely.
 */
export async function fetchQuote(
  fromRaw: string,
  toRaw: string,
  date: string,
): Promise<FxQuote | null> {
  const from = normalizeCurrency(fromRaw);
  const to = normalizeCurrency(toRaw);
  if (!from || !to) return null;
  if (from === to) return { rate: 1, rateDate: date, source: 'identity' };

  return (await fromFrankfurter(from, to, date)) ?? (await fromErApi(from, to));
}

/** Whether a pair can be dated accurately, for messaging and tests. */
export function supportsHistorical(from: string, to: string): boolean {
  const a = normalizeCurrency(from);
  const b = normalizeCurrency(to);
  return !!a && !!b && ECB_CURRENCIES.has(a) && ECB_CURRENCIES.has(b);
}
