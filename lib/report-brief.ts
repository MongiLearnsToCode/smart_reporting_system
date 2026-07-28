// Deterministic facts behind an executive brief.
//
// Everything a report asserts about numbers, counts, and names is computed
// here — never by the language model. The model only turns these facts into
// prose, so a wrong figure can't be hallucinated into a client-facing document.

import { entitiesOf, type Log, type LogEntity } from "./dashboard-utils";
import { baseAmountOf, normalizeCurrency } from "./fx";

export const SECTION_IDS = [
  "executive_summary",
  "progress",
  "financials",
  "next_steps",
  // Last, and deliberately separate from Next Steps: that section is what the
  // sender will do, this one is what the reader has to. Every study of client
  // reporting says the single specific ask is the part that gets acted on, and
  // it is the part most reports omit.
  "decisions",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_TITLES: Record<SectionId, string> = {
  executive_summary: "Executive Summary",
  progress: "Progress",
  financials: "Financials",
  next_steps: "Next Steps",
  decisions: "Needs Your Decision",
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
  /**
   * How long each blocked item has been outstanding. "Blocked" is a state;
   * "blocked for 21 days" is a problem — the number is what turns a list into
   * something a reader has to answer.
   */
  blockedAging: { item: string; days: number }[];
  /**
   * The share of spend the largest category took. A total says how much went
   * out; this says where it concentrated, which is the part with a decision
   * attached to it.
   */
  concentration: { category: string; share: number } | null;
  /**
   * The few entries carrying the most signal, in the user's own words. The
   * narrator never prints these — they go to the model as raw material so it
   * can synthesise rather than recite counts, which is the difference between
   * a brief report and a shallow one.
   */
  notable: { text: string; category: string; at: number }[];
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
  const blockedSince = new Map<string, number>();
  const notable: { text: string; category: string; at: number; weight: number }[] = [];

  for (const log of included) {
    const category = log.category || "Other";
    categories.set(category, (categories.get(category) ?? 0) + 1);
    const ts = new Date(log.timestamp);
    if (!Number.isNaN(ts.getTime())) days.add(ts.toISOString().slice(0, 10));

    for (const entity of entitiesOf(log)) {
      pushUnique(clients, cleanText(entity.client, 60), 12);

      // Prefer the converted figure so the report totals in one currency.
      // baseAmountOf returns null when no rate was ever obtained for this
      // entity, and then — and only then — the original currency survives into
      // its own bucket. A second bucket in a report is a visible signal that a
      // conversion is missing, which is the right failure: it is obvious rather
      // than silently wrong.
      const converted = baseAmountOf(entity, defaultCurrency);
      const amount = converted !== null
        ? converted
        : typeof entity.amount === "number" && Number.isFinite(entity.amount)
          ? entity.amount
          : null;
      if (amount !== null && amount !== 0) {
        const currency = converted !== null
          ? normalizeCurrency(defaultCurrency) ?? UNKNOWN_CURRENCY
          : currencyOf(entity, defaultCurrency);
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
      if (entity.status === "blocked") {
        pushUnique(blockedItems, label, 8);
        // Earliest mention, not latest: an item raised three weeks ago and
        // repeated since has been stuck three weeks, not one day.
        if (label) {
          const at = new Date(log.timestamp).getTime();
          const seen = blockedSince.get(label);
          if (Number.isFinite(at) && (seen === undefined || at < seen)) blockedSince.set(label, at);
        }
      }
      if (entity.status === "open" || entity.status === "in_progress") {
        pushUnique(openItems, label, 8);
      }
      if (entity.status === "complete") pushUnique(deliverables, cleanText(entity.deliverable), 8);
      pushUnique(risks, cleanText(entity.issue_or_risk), 8);

      // Rank entries by how much a reader would want them mentioned: money
      // moved, then a blocker or risk, then urgency. The raw text goes with
      // them so the narration has something to quote.
      const raw = cleanText(log.raw_content, 400);
      if (raw) {
        const weight =
          (amount !== null ? Math.min(Math.abs(amount) / 1000, 6) : 0) +
          (entity.status === "blocked" ? 4 : 0) +
          (entity.issue_or_risk ? 3 : 0) +
          (entity.urgency === "high" ? 2 : 0) +
          (entity.status === "complete" ? 1 : 0);
        // One entry, not one per entity: a log holding an expense and a task
        // is still a single thing the reader would be told about once.
        if (weight > 0) {
          const at = new Date(log.timestamp).getTime();
          const existing = notable.find((n) => n.text === raw);
          if (existing) existing.weight = Math.max(existing.weight, weight);
          else notable.push({ text: raw, category, at, weight });
        }
      }
    }
  }

  const net = new Map<string, number>();
  for (const [currency, amount] of income) addMoney(net, currency, amount);
  for (const [currency, amount] of spend) addMoney(net, currency, -amount);

  const spendRows = Array.from(spendByCategory, ([category, totals]) => ({
    category,
    totals: toTotals(totals),
  })).sort((a, b) => (b.totals[0]?.amount ?? 0) - (a.totals[0]?.amount ?? 0));

  // Share is only meaningful within one currency. Where a conversion is
  // missing and totals are split across currencies, there is no honest
  // denominator, so no claim is made.
  let concentration: BriefFacts["concentration"] = null;
  const spendTotals = toTotals(spend);
  if (spendRows.length > 1 && spendTotals.length === 1 && spendTotals[0].amount > 0) {
    const top = spendRows[0].totals.find((t) => t.currency === spendTotals[0].currency);
    if (top) {
      concentration = {
        category: spendRows[0].category,
        share: Math.round((top.amount / spendTotals[0].amount) * 100),
      };
    }
  }

  const now = Date.now();
  const blockedAging = blockedItems
    .map((item) => ({
      item,
      days: Math.max(0, Math.floor((now - (blockedSince.get(item) ?? now)) / 86400000)),
    }))
    .sort((a, b) => b.days - a.days);

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
    blockedAging,
    concentration,
    notable: notable
      .sort((a, b) => b.weight - a.weight || b.at - a.at)
      .slice(0, 6)
      .map(({ text, category, at }) => ({ text, category, at })),
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
        facts.risks.length > 0 ||
        facts.tasks.open + facts.tasks.inProgress > 0
      );
    // Only when there is a real, nameable thing waiting on the reader. An
    // empty "Needs Your Decision" heading trains people to skip it.
    case "decisions":
      return facts.blockedItems.length > 0;
  }
}

export function activeSections(facts: BriefFacts): SectionId[] {
  return SECTION_IDS.filter((id) => sectionHasSubstance(id, facts));
}

// ---------------------------------------------------------------------------
// Comparison against the preceding window
//
// A figure on its own is close to unreadable: "spend totalled USD 4,200" tells
// a reader nothing without knowing it was USD 6,100 last month. Both windows
// are the same length by construction, so the two are directly comparable.

export type MoneyDelta = {
  currency: string;
  current: number;
  previous: number;
  /** Null when the previous window was zero — that is "new", not "up ∞%". */
  changePct: number | null;
};

export type CountDelta = { current: number; previous: number; change: number };

export type BriefComparison = {
  /** Length of each window in days. Both are equal, which is what makes this fair. */
  windowDays: number;
  spend: MoneyDelta[];
  income: MoneyDelta[];
  completed: CountDelta;
  /** Nothing at all in the preceding window — usually a first report. */
  priorEmpty: boolean;
};

function moneyDeltas(current: MoneyTotal[], previous: MoneyTotal[]): MoneyDelta[] {
  const prev = new Map(previous.map((t) => [t.currency, t.amount]));
  const out: MoneyDelta[] = [];
  for (const t of current) {
    const before = prev.get(t.currency) ?? 0;
    out.push({
      currency: t.currency,
      current: t.amount,
      previous: before,
      changePct: before === 0 ? null : Math.round(((t.amount - before) / Math.abs(before)) * 100),
    });
  }
  return out;
}

/**
 * Deltas between a report's window and the equal-length window before it.
 *
 * Currencies present only in the earlier window are left out: a report is about
 * the period it covers, and "spend in a currency you no longer use is down
 * 100%" is noise. Currencies new to this window come through with a null
 * changePct, which the narrator reads as "new" rather than a percentage.
 */
export function compareFacts(
  current: BriefFacts,
  previous: BriefFacts,
  windowDays: number,
): BriefComparison {
  return {
    windowDays,
    spend: moneyDeltas(current.spend, previous.spend),
    income: moneyDeltas(current.income, previous.income),
    completed: {
      current: current.tasks.completed,
      previous: previous.tasks.completed,
      change: current.tasks.completed - previous.tasks.completed,
    },
    priorEmpty: previous.entryCount === 0,
  };
}

/** "down 31%" / "up 12%" / "level with" — the phrase a sentence can absorb. */
export function changePhrase(changePct: number | null): string | null {
  if (changePct === null) return null;
  if (changePct === 0) return "level with";
  return `${changePct > 0 ? "up" : "down"} ${Math.abs(changePct)}% from`;
}

/**
 * Structural check on facts read back from a stored draft.
 *
 * A draft outlives the code that wrote it. BriefFacts has grown four fields in
 * a single day of work, so a draft saved before a deploy can be opened after
 * one, and the export path indexes straight into these arrays —
 * `facts.spend.map(...)`, `facts.tasks.completed` — which throws on a shape it
 * doesn't recognise.
 *
 * A validator on the column would not help: Convex validates writes, so rows
 * written under the old shape survive and then fail schema validation, which
 * can block a deploy until they are migrated. Guarding the read is what fails
 * safe — an unrecognised shape costs the stat strip and the chart, and the
 * prose the user actually wrote still exports.
 */
export function isBriefFacts(value: unknown): value is BriefFacts {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;

  const isTotals = (v: unknown) =>
    Array.isArray(v) &&
    v.every(
      (t) =>
        t && typeof t === "object" &&
        typeof (t as MoneyTotal).currency === "string" &&
        typeof (t as MoneyTotal).amount === "number",
    );

  if (!isTotals(f.spend) || !isTotals(f.income) || !isTotals(f.net)) return false;
  if (
    !Array.isArray(f.spendByCategory) ||
    !f.spendByCategory.every(
      (row) =>
        row && typeof row === "object" &&
        typeof (row as { category?: unknown }).category === "string" &&
        isTotals((row as { totals?: unknown }).totals),
    )
  ) return false;

  const tasks = f.tasks as Record<string, unknown> | undefined;
  if (
    !tasks || typeof tasks !== "object" ||
    typeof tasks.completed !== "number" || typeof tasks.inProgress !== "number" ||
    typeof tasks.open !== "number" || typeof tasks.blocked !== "number"
  ) return false;

  if (typeof f.entryCount !== "number") return false;
  for (const key of ["deliverables", "blockedItems"]) {
    if (!Array.isArray(f[key])) return false;
  }
  return true;
}
