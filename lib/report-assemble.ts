// Combines model prose with the deterministic narrative into final sections.
//
// The model is treated as untrusted: its text is stripped of filler, capped in
// length, and checked against the facts. Any section citing a figure the facts
// don't support is discarded in favour of the deterministic version, so a
// hallucinated number can never reach a client.

import { activeSections, SECTION_TITLES, type BriefComparison, type BriefFacts, type SectionId } from "./report-brief";
import { decisionItems, narrateSection, type BriefContext } from "./report-narrative";
import { tightenProse } from "./report-prose";

export type BriefSection = {
  id: SectionId;
  title: string;
  body: string;
  /** Which pipeline produced the text — surfaced in tests and diagnostics. */
  source: "ai" | "facts";
  /** Rendered as a short bulleted list under the body. Asks, verbatim. */
  items?: string[];
};

export type Brief = {
  title: string;
  scopeLabel: string;
  periodLabel: string;
  generatedAt: number;
  sections: BriefSection[];
  facts: BriefFacts;
  /** Deltas against the preceding window; null when none could be built. */
  comparison: BriefComparison | null;
};

const EPSILON = 0.005;

/** Every numeric value the brief is allowed to state. */
export function collectAllowedNumbers(facts: BriefFacts, ctx: BriefContext): number[] {
  const allowed: number[] = [
    facts.entryCount,
    facts.activeDays,
    facts.tasks.completed,
    facts.tasks.inProgress,
    facts.tasks.open,
    facts.tasks.blocked,
    facts.tasks.open + facts.tasks.inProgress,
    facts.tasks.open + facts.tasks.inProgress + facts.tasks.blocked,
    facts.clients.length,
    facts.deliverables.length,
    facts.risks.length,
    facts.blockedItems.length,
    facts.openItems.length,
    facts.categories.length,
  ];

  for (const c of facts.categories) allowed.push(c.count);
  // Aging and concentration are computed facts like any other. Without them
  // the guard rejected the deterministic narrative's own sentences — the
  // report's last line of defence firing on the report itself.
  for (const a of facts.blockedAging) allowed.push(a.days);
  if (facts.concentration) allowed.push(facts.concentration.share);
  for (const group of [facts.spend, facts.income, facts.net]) {
    for (const t of group) {
      allowed.push(t.amount, Math.abs(t.amount), Math.round(Math.abs(t.amount)));
    }
  }
  for (const row of facts.spendByCategory) {
    for (const t of row.totals) allowed.push(t.amount, Math.abs(t.amount));
  }

  // Numbers appearing in the period label ("Last 30 days") are legitimate.
  for (const match of ctx.periodLabel.matchAll(/\d+(?:\.\d+)?/g)) {
    allowed.push(Number(match[0]));
  }

  // Comparison figures. Without these the guard would reject the model for
  // repeating a prior-period total or a percentage change that the facts do
  // in fact support — the deltas are computed here, not by the model.
  const cmp = ctx.comparison;
  if (cmp) {
    allowed.push(cmp.windowDays, cmp.completed.previous, Math.abs(cmp.completed.change));
    for (const group of [cmp.spend, cmp.income]) {
      for (const d of group) {
        allowed.push(d.current, d.previous, Math.round(d.previous));
        if (d.changePct !== null) allowed.push(d.changePct, Math.abs(d.changePct));
      }
    }
  }

  return allowed.filter((n) => Number.isFinite(n));
}

/** Numeric tokens in the text, with thousands separators removed. */
export function extractFigures(text: string): number[] {
  const figures: number[] = [];
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const value = Number(match[0].replace(/,/g, ""));
    if (Number.isFinite(value)) figures.push(value);
  }
  return figures;
}

/** Every money figure the facts state, for the formatting check below. */
export function moneyAmounts(facts: BriefFacts): number[] {
  const out: number[] = [];
  for (const group of [facts.spend, facts.income, facts.net]) {
    for (const t of group) out.push(Math.abs(t.amount));
  }
  for (const row of facts.spendByCategory) {
    for (const t of row.totals) out.push(Math.abs(t.amount));
  }
  return out;
}

/**
 * Catches money the model reformatted into its own house style.
 *
 * The figures can be right and the document still wrong: "$8000" in prose
 * beside "USD 8,000" in the stat strip and the chart reads as two different
 * numbers from two different systems. The guard above checks that a figure is
 * true; this one checks it is stated the way the rest of the document states
 * it. A section that fails falls back to the deterministic narrative, which
 * formats money through one function.
 */
export function hasMisformattedMoney(text: string, amounts: number[]): boolean {
  // A currency symbol glued to a digit is never house style here.
  if (/[$€£¥₦₹]\s?\d/.test(text)) return true;
  for (const match of text.matchAll(/(?<![\d.,])(\d{4,}(?:\.\d+)?)(?![\d.,])/g)) {
    const value = Number(match[1]);
    if (amounts.some((a) => Math.abs(a - value) < 0.005)) return true;
  }
  return false;
}

export function hasUnsupportedFigures(text: string, allowed: number[]): boolean {
  return extractFigures(text).some(
    (figure) => !allowed.some((ok) => Math.abs(ok - figure) < EPSILON),
  );
}

/**
 * Builds the final section list. `aiSections` is whatever the model returned,
 * keyed by section id; missing, empty, filler-only or unsupported entries fall
 * back to the deterministic narrative.
 */
export function assembleBrief(opts: {
  title: string;
  facts: BriefFacts;
  ctx: BriefContext;
  aiSections?: Partial<Record<SectionId, string>> | null;
  generatedAt?: number;
  maxSentences?: number;
}): Brief {
  const { facts, ctx, aiSections } = opts;
  const allowed = collectAllowedNumbers(facts, ctx);
  const amounts = moneyAmounts(facts);
  const maxSentences = opts.maxSentences ?? 4;

  const sections: BriefSection[] = activeSections(facts).map((id) => {
    const fallback = tightenProse(narrateSection(id, facts, ctx), maxSentences);
    // The asks are quoted from the user's own entries, never paraphrased.
    const items = id === "decisions" ? decisionItems(facts) : undefined;
    const candidate = aiSections?.[id];

    // The decisions section is never model-written. A blocker restated more
    // diplomatically stops being a blocker, and the whole value of the section
    // is that it says the uncomfortable thing in the sender's own words.
    if (id !== "decisions" && typeof candidate === "string") {
      const cleaned = tightenProse(candidate, maxSentences);
      if (cleaned && !hasUnsupportedFigures(cleaned, allowed) && !hasMisformattedMoney(cleaned, amounts)) {
        return { id, title: SECTION_TITLES[id], body: cleaned, source: "ai" as const, items };
      }
    }
    return { id, title: SECTION_TITLES[id], body: fallback, source: "facts" as const, items };
  });

  return {
    title: opts.title,
    scopeLabel: ctx.scopeLabel,
    periodLabel: ctx.periodLabel,
    generatedAt: opts.generatedAt ?? Date.now(),
    // A section whose text came out empty carries no information; drop it
    // rather than print a heading over whitespace.
    sections: sections.filter((s) => s.body.trim().length > 0),
    facts,
    comparison: ctx.comparison ?? null,
  };
}
