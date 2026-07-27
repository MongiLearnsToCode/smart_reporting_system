// Tabular and at-a-glance data for the brief.
//
// Per the brief's design direction, tables and stats are used selectively to
// visualise what prose states poorly — money split across categories, a handful
// of headline counts — never as a substitute for the narrative.

import { formatAmount, formatTotals, type BriefFacts } from "./report-brief";

export type TableRow = { label: string; value: string };
export type Stat = { label: string; value: string };

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
export function highlightStats(facts: BriefFacts): Stat[] {
  const stats: Stat[] = [];

  if (facts.income.length) {
    stats.push({ label: "Income", value: formatTotals(facts.income) });
  }
  if (facts.spend.length) {
    stats.push({ label: "Spend", value: formatTotals(facts.spend) });
  }
  if (facts.tasks.completed > 0) {
    stats.push({ label: "Completed", value: String(facts.tasks.completed) });
  }

  const outstanding = facts.tasks.open + facts.tasks.inProgress;
  if (stats.length < 4 && outstanding > 0) {
    stats.push({ label: "Outstanding", value: String(outstanding) });
  }
  if (stats.length < 4 && facts.tasks.blocked > 0) {
    stats.push({ label: "Blocked", value: String(facts.tasks.blocked) });
  }
  if (stats.length < 4 && facts.clients.length > 0) {
    stats.push({ label: "Clients", value: String(facts.clients.length) });
  }
  if (stats.length === 0) {
    stats.push({ label: "Entries", value: String(facts.entryCount) });
  }

  return stats.slice(0, 4);
}
