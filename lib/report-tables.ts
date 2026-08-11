// Tabular and at-a-glance data for the brief.
//
// Per the brief's design direction, tables and stats are used selectively to
// visualise what prose states poorly — money split across categories, a handful
// of headline counts — never as a substitute for the narrative.

import { formatAmount, formatTotals, type BriefComparison, type BriefFacts } from "./report-brief";

export type TableRow = { label: string; value: string };
export type Stat = {
  label: string;
  value: string;
  /** Direction of travel, rendered on its own line — see deltaLabel. */
  delta?: string;
  /** Specific context for a count, rather than a second vague count. */
  detail?: string;
};

function namedItems(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, 2).join(' · ')}${items.length > 2 ? ` +${items.length - 2}` : ''}`;
}

/** Spend by category, largest first, with a total row when it adds context. */
export function financialRows(facts: BriefFacts): TableRow[] {
  const rows: TableRow[] = facts.spendByCategory.map((row) => ({
    label: row.category,
    value: row.totals.map((t) => formatAmount(t.amount, t.currency)).join(" · "),
  }));

  // A single category already equals the total; repeating it is noise.
  if (rows.length > 1 && facts.spend.length > 0) {
    rows.push({ label: "Total spend", value: formatTotals(facts.spend) });
  }
  return rows;
}

/**
 * Headline figures for the summary strip. Capped at four — beyond that it
 * stops being a glance and becomes a table.
 */
export function highlightStats(facts: BriefFacts, comparison?: BriefComparison | null): Stat[] {
  const stats: Stat[] = [];

  // Net first. Whether the period paid for itself is the outcome; income and
  // spend are the workings. A reader who only looks at the strip should come
  // away with the answer, not the inputs.
  if (facts.income.length && facts.spend.length && facts.net.length) {
    stats.push({ label: "Approx. net position", value: formatTotals(facts.net) });
  }
  if (facts.income.length) {
    stats.push({ label: "Approx. income", value: formatTotals(facts.income), delta: deltaLabel(facts.income, comparison?.income) });
  }
  if (facts.spend.length) {
    stats.push({ label: "Approx. spend", value: formatTotals(facts.spend), delta: deltaLabel(facts.spend, comparison?.spend) });
  }
  if (stats.length < 4 && facts.deliverables.length > 0) {
    stats.push({
      label: "Delivered",
      value: String(facts.deliverables.length),
      detail: namedItems(facts.deliverables, "Deliverables completed"),
    });
  } else if (stats.length < 4 && facts.tasks.completed > 0) {
    stats.push({ label: "Completed", value: String(facts.tasks.completed), detail: "Tasks completed" });
  }
  if (stats.length < 4 && facts.blockedItems.length > 0) {
    stats.push({
      label: "Awaiting decision",
      value: String(facts.blockedItems.length),
      detail: namedItems(facts.blockedItems, "Decision required"),
    });
  }

  const outstanding = facts.tasks.open + facts.tasks.inProgress;
  if (stats.length < 4 && outstanding > 0) {
    stats.push({
      label: "Outstanding",
      value: String(outstanding),
      detail: namedItems(facts.openItems, "Work in progress"),
    });
  }
  // Last resort only. An entry count says how much the tool was used, which is
  // the one thing the reader has no use for — it appears when the period
  // genuinely produced nothing else to report.
  if (stats.length === 0) {
    stats.push({ label: "Entries", value: String(facts.entryCount) });
  }

  return stats.slice(0, 4);
}

/**
 * "−31%" — direction of travel, kept as its own field so the renderer can put
 * it on its own line. Appended to the value string it wrapped inside a narrow
 * stat column and broke as "USD 2,827.77 −" / "31%", which reads as a negative
 * amount: a formatting artefact that changes what the number appears to say.
 *
 * ASCII "-", not U+2212 MINUS SIGN. Helvetica's WinAnsi encoding carries the
 * em dash and middot this document uses elsewhere, but not U+2212 — react-pdf
 * dropped the glyph silently and "−31%" printed as "31%", turning a fall in
 * spending into what reads as a rise.
 */
function deltaLabel(
  totals: { currency: string }[],
  deltas: BriefComparison["spend"] | undefined,
): string | undefined {
  if (!deltas?.length || totals.length !== 1) return undefined;
  const delta = deltas.find((d) => d.currency === totals[0].currency);
  if (!delta || delta.changePct === null || delta.changePct === 0) return undefined;
  return `${delta.changePct > 0 ? "+" : "-"}${Math.abs(delta.changePct)}%`;
}
