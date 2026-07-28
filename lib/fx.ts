// Currency conversion to the user's default currency.
//
// The rule this file exists to enforce: a converted figure is only ever
// arithmetic over a rate that came from a rate provider. The extraction model
// never supplies a rate — it cannot know one, and a plausible-looking invented
// rate in a document going to a client or a lender is a fabricated financial
// figure. Where no rate could be obtained, the original currency survives
// untouched and downstream code reports it in its own bucket.
//
// The original amount and currency are never overwritten. Conversion is
// strictly additive, so the log always shows what the user actually said.

/** Provenance for one converted amount. Stored beside the original, never over it. */
export type FxQuote = {
  /** One unit of the source currency in units of the target currency. */
  rate: number;
  /** The date the rate is actually dated — not necessarily the entry's date. */
  rateDate: string;
  /** Which provider supplied it, so a report footnote can name the source. */
  source: string;
};

/** The fields conversion adds to a money entity. All absent when unconverted. */
export type FxFields = {
  base_amount?: number | null;
  base_currency?: string | null;
  fx_rate?: number | null;
  fx_date?: string | null;
  fx_source?: string | null;
};

type MoneyLike = { amount?: number | null; currency?: string | null } & FxFields;

/**
 * Currencies the ECB publishes reference rates for, which is what lets
 * Frankfurter answer for a specific past date. Anything outside this set can
 * only be had at the latest rate, which the quote's own date discloses.
 */
export const ECB_CURRENCIES = new Set([
  'EUR', 'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** True when both sides are ECB-quoted, so a dated historical rate is available. */
export function isEcbPair(from: string, to: string): boolean {
  return ECB_CURRENCIES.has(from) && ECB_CURRENCIES.has(to);
}

/**
 * Whether this entity needs a rate looked up at all. An entity with no amount,
 * no currency, or one already in the base currency does not.
 */
export function needsConversion(entity: MoneyLike, baseCurrency: string): boolean {
  if (typeof entity.amount !== 'number' || !Number.isFinite(entity.amount)) return false;
  const from = normalizeCurrency(entity.currency);
  const to = normalizeCurrency(baseCurrency);
  if (!from || !to) return false;
  return from !== to;
}

/** Money rounds to cents. Anything finer is noise the source rate can't support. */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** Attach a quote to an entity without disturbing what the user originally said. */
export function applyQuote<T extends MoneyLike>(
  entity: T,
  baseCurrency: string,
  quote: FxQuote,
): T {
  if (typeof entity.amount !== 'number' || !Number.isFinite(entity.amount)) return entity;
  return {
    ...entity,
    base_amount: convertAmount(entity.amount, quote.rate),
    base_currency: normalizeCurrency(baseCurrency),
    fx_rate: quote.rate,
    fx_date: quote.rateDate,
    fx_source: quote.source,
  };
}

/**
 * The amount to report, in the base currency — or null when this entity cannot
 * honestly be expressed in it.
 *
 * Null is a real answer, not a failure to handle: it means no rate was ever
 * obtained, or the stored conversion targets a currency the user has since
 * changed away from. Callers fall back to the original currency rather than
 * showing a number that was converted against the wrong target.
 */
export function baseAmountOf(entity: MoneyLike, baseCurrency: string): number | null {
  if (typeof entity.amount !== 'number' || !Number.isFinite(entity.amount)) return null;
  const to = normalizeCurrency(baseCurrency);
  if (!to) return null;

  const from = normalizeCurrency(entity.currency);
  // No currency named at all means the amount was already understood as base —
  // that is what the extractor's "default currency" instruction establishes.
  if (from === null || from === to) return entity.amount;

  if (
    typeof entity.base_amount === 'number' &&
    Number.isFinite(entity.base_amount) &&
    normalizeCurrency(entity.base_currency) === to
  ) {
    return entity.base_amount;
  }
  return null;
}

/** Cache key for one pair on one date. Rates are reference data, shared by all users. */
export function rateKey(from: string, to: string, date: string): string {
  return `${from}:${to}:${date}`;
}

/** YYYY-MM-DD, which is the granularity every rate provider quotes at. */
export function isoDay(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10);
}

/**
 * One line naming every rate a document relied on, for the report footnote.
 * A converted total that doesn't say what it was converted at is not auditable.
 */
export function rateFootnote(
  quotes: { from: string; to: string; rate: number; date: string; source: string }[],
): string | null {
  if (!quotes.length) return null;
  const seen = new Map<string, string>();
  for (const q of quotes) {
    if (q.from === q.to) continue;
    // Six significant digits: enough to reproduce the conversion, not so many
    // that the line reads as false precision.
    seen.set(`${q.from}:${q.to}`, `1 ${q.from} = ${Number(q.rate.toPrecision(6))} ${q.to} (${q.date})`);
  }
  if (!seen.size) return null;
  const sources = Array.from(new Set(quotes.map((q) => q.source).filter(Boolean))).sort();
  return `Converted at ${Array.from(seen.values()).sort().join('; ')}. Source: ${sources.join(', ')}.`;
}
