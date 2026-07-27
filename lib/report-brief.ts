// Deterministic facts behind an executive brief.
//
// Everything a report asserts about numbers, counts, and names is computed
// here — never by the language model. The model only turns these facts into
// prose, so a wrong figure can't be hallucinated into a client-facing document.

import { entitiesOf, type Log, type LogEntity } from "./dashboard-utils";

export const SECTION_IDS = [
  "executive_summary",
  "progress",
  "financials",
  "next_steps",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_TITLES: Record<SectionId, string> = {
  executive_summary: "Executive Summary",
  progress: "Progress",
  financials: "Financials",
  next_steps: "Next Steps",
};

export type MoneyTotal = { currency: string; amount: number };

export type BriefFacts = {
  entryCount: number;
  /** Distinct days on which something was logged — a crude activity measure. */
  activeDays: number;
  categories: { category: string; count: number }[];
  clients: string[];
  spend: MoneyTotal[];
  income: MoneyTotal[];
  net: MoneyTotal[];
  /** Spend broken out by category, for the financials table. */
  spendByCategory: { category: string; totals: MoneyTotal[] }[];
  tasks: { completed: number; inProgress: number; open: number; blocked: number };
  deliverables: string[];
  risks: string[];
  blockedItems: string[];
  openItems: string[];
};

const UNKNOWN_CURRENCY = "—";

function currencyOf(entity: LogEntity, fallback: string): string {
  const raw = typeof entity.currency === "string" ? entity.currency.trim().toUpperCase() : "";
  return raw || fallback || UNKNOWN_CURRENCY;
}

function addMoney(into: Map<string, number>, currency: string, amount: number) {
  into.set(currency, (into.get(currency) ?? 0) + amount);
}

/** Stable ordering: largest absolute total first, then currency code. */
function toTotals(map: Map<string, number>): MoneyTotal[] {
  return Array.from(map, ([currency, amount]) => ({ currency, amount }))
    .filter((t) => t.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.currency.localeCompare(b.currency));
}

function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, max) : null;
}

function pushUnique(list: string[], value: string | null, cap: number) {
  if (!value || list.length >= cap) return;
  if (!list.some((v) => v.toLowerCase() === value.toLowerCase())) list.push(value);
}

/**
 * Reduces the report's logs to the facts the brief is allowed to state.
 * `defaultCurrency` labels amounts the extractor left uncurrencied.
 */
export function buildBriefFacts(logs: Log[], defaultCurrency = "USD"): BriefFacts {
  const included = logs.filter((l) => !l.excluded_from_reports);

  const categories = new Map<string, number>();
  const days = new Set<string>();
  const clients: string[] = [];
  const spend = new Map<string, number>();
  const income = new Map<string, number>();
  const spendByCategory = new Map<string, Map<string, number>>();
  const tasks = { completed: 0, inProgress: 0, open: 0, blocked: 0 };
  const deliverables: string[] = [];
  const risks: string[] = [];
  const blockedItems: string[] = [];
  const openItems: string[] = [];

  for (const log of included) {
    const category = log.category || "Other";
    categories.set(category, (categories.get(category) ?? 0) + 1);
    const ts = new Date(log.timestamp);
    if (!Number.isNaN(ts.getTime())) days.add(ts.toISOString().slice(0, 10));

    for (const entity of entitiesOf(log)) {
      pushUnique(clients, cleanText(entity.client, 60), 12);

      const amount = typeof entity.amount === "number" && Number.isFinite(entity.amount)
        ? entity.amount
        : null;
      if (amount !== null && amount !== 0) {
        const currency = currencyOf(entity, defaultCurrency);
        // Only expense/income entities move money. A task that happens to carry
        // a figure is a quote, not a transaction.
        if (entity.type === "expense") {
          addMoney(spend, currency, Math.abs(amount));
          const bucket = spendByCategory.get(category) ?? new Map<string, number>();
          addMoney(bucket, currency, Math.abs(amount));
          spendByCategory.set(category, bucket);
        } else if (entity.type === "income") {
          addMoney(income, currency, Math.abs(amount));
        }
      }

      if (entity.type === "task" || entity.status) {
        if (entity.status === "complete") tasks.completed++;
        else if (entity.status === "in_progress") tasks.inProgress++;
        else if (entity.status === "blocked") tasks.blocked++;
        else if (entity.status === "open") tasks.open++;
      }

      const label = cleanText(entity.task) ?? cleanText(entity.deliverable);
      if (entity.status === "blocked") pushUnique(blockedItems, label, 8);
      if (entity.status === "open" || entity.status === "in_progress") {
        pushUnique(openItems, label, 8);
      }
      if (entity.status === "complete") pushUnique(deliverables, cleanText(entity.deliverable), 8);
      pushUnique(risks, cleanText(entity.issue_or_risk), 8);
    }
  }

  const net = new Map<string, number>();
  for (const [currency, amount] of income) addMoney(net, currency, amount);
  for (const [currency, amount] of spend) addMoney(net, currency, -amount);

  return {
    entryCount: included.length,
    activeDays: days.size,
    categories: Array.from(categories, ([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    clients,
    spend: toTotals(spend),
    income: toTotals(income),
    net: toTotals(net),
    spendByCategory: Array.from(spendByCategory, ([category, totals]) => ({
      category,
      totals: toTotals(totals),
    }))
      .filter((row) => row.totals.length > 0)
      .sort((a, b) => {
        const aMax = Math.max(...a.totals.map((t) => t.amount));
        const bMax = Math.max(...b.totals.map((t) => t.amount));
        return bMax - aMax || a.category.localeCompare(b.category);
      }),
    tasks,
    deliverables,
    risks,
    blockedItems,
    openItems,
  };
}

/**
 * Deterministic money formatting. Intl output shifts with the ICU version on
 * the host, which makes both tests and printed reports unstable, so the format
 * is fixed here: thousands separators, decimals only when the value has them.
 */
export function formatAmount(amount: number, currency: string): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.004;
  const [whole, fraction = ""] = rounded.toFixed(hasCents ? 2 : 0).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 ? "-" : "";
  const body = fraction ? `${grouped}.${fraction}` : grouped;
  return `${sign}${currency === UNKNOWN_CURRENCY ? "" : currency + " "}${body}`.trim();
}

export function formatTotals(totals: MoneyTotal[]): string {
  if (totals.length === 0) return "nothing";
  return totals.map((t) => formatAmount(t.amount, t.currency)).join(" and ");
}

/** A section is only rendered when the facts give it something to say. */
export function sectionHasSubstance(id: SectionId, facts: BriefFacts): boolean {
  if (facts.entryCount === 0) return false;
  switch (id) {
    case "executive_summary":
      return true;
    case "progress":
      return (
        facts.tasks.completed + facts.tasks.inProgress + facts.tasks.open + facts.tasks.blocked > 0 ||
        facts.deliverables.length > 0 ||
        facts.categories.length > 0
      );
    case "financials":
      return facts.spend.length > 0 || facts.income.length > 0;
    case "next_steps":
      return (
        facts.openItems.length > 0 ||
        facts.blockedItems.length > 0 ||
        facts.risks.length > 0 ||
        facts.tasks.open + facts.tasks.inProgress + facts.tasks.blocked > 0
      );
  }
}

export function activeSections(facts: BriefFacts): SectionId[] {
  return SECTION_IDS.filter((id) => sectionHasSubstance(id, facts));
}
