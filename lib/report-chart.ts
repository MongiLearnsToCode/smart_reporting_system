// Chart data for the brief's Financials section.
//
// The chart is drawn natively in the PDF from these numbers — never captured
// from the canvas. Canvas blocks are unconditionally dark (no light variants),
// so a screenshot would drop a dark rectangle into a light document, and a
// raster image would print soft next to vector type.
//
// Form and colour follow the data-viz method:
//  - Horizontal bars for magnitude across named categories.
//  - ONE hue for every bar. Colouring bars by category would double-encode
//    length as hue when the category is already on the axis.
//  - One axis: bars only ever show a single currency, because two currencies
//    are two scales and cannot share one.
//  - No one-bar bar charts — a single category is a number, not a chart.

import { formatAmount, type BriefFacts } from "./report-brief";
import { financialRows, type TableRow } from "./report-tables";

/** Categorical slot 1, validated against the light surface (contrast >= 3:1). */
export const CHART_INK = "#2a78d6";

export type Bar = {
  label: string;
  value: number;
  /** Pre-formatted for a direct label — print has no tooltip to fall back on. */
  formatted: string;
  /** 0–1 against the largest bar, for width. */
  ratio: number;
};

export type FinancialVisual =
  | { kind: "chart"; currency: string; bars: Bar[] }
  | { kind: "table"; rows: TableRow[] }
  | null;

const MIN_BARS = 2;

/**
 * Chooses how the Financials section shows its numbers.
 *
 * A chart when the money is in one currency across several categories — it
 * carries the values as direct labels, so it replaces the table rather than
 * duplicating it. A table whenever a chart would mislead or say nothing:
 * mixed currencies (which can't share an axis) or a single category.
 */
export function financialVisual(facts: BriefFacts): FinancialVisual {
  if (facts.spend.length === 0) return null;

  const currencies = new Set(facts.spend.map((t) => t.currency));
  if (currencies.size === 1) {
    const currency = facts.spend[0].currency;
    const bars = facts.spendByCategory
      .map((row) => {
        const total = row.totals.find((t) => t.currency === currency);
        return total ? { label: row.category, value: total.amount } : null;
      })
      .filter((b): b is { label: string; value: number } => b !== null)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    if (bars.length >= MIN_BARS) {
      const max = bars[0].value;
      return {
        kind: "chart",
        currency,
        bars: bars.map((b) => ({
          ...b,
          formatted: formatAmount(b.value, currency),
          ratio: max > 0 ? b.value / max : 0,
        })),
      };
    }
  }

  const rows = financialRows(facts);
  return rows.length ? { kind: "table", rows } : null;
}
