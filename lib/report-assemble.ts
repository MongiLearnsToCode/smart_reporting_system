// Combines model prose with the deterministic narrative into final sections.
//
// The model is treated as untrusted: its text is stripped of filler, capped in
// length, and checked against the facts. Any section citing a figure the facts
// don't support is discarded in favour of the deterministic version, so a
// hallucinated number can never reach a client.

import { activeSections, SECTION_TITLES, type BriefFacts, type SectionId } from "./report-brief";
import { narrateSection, type BriefContext } from "./report-narrative";
import { tightenProse } from "./report-prose";

export type BriefSection = {
  id: SectionId;
  title: string;
  body: string;
  /** Which pipeline produced the text — surfaced in tests and diagnostics. */
  source: "ai" | "facts";
};

export type Brief = {
  title: string;
  scopeLabel: string;
  periodLabel: string;
  generatedAt: number;
  sections: BriefSection[];
  facts: BriefFacts;
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
  const maxSentences = opts.maxSentences ?? 4;

  const sections: BriefSection[] = activeSections(facts).map((id) => {
    const fallback = tightenProse(narrateSection(id, facts, ctx), maxSentences);
    const candidate = aiSections?.[id];

    if (typeof candidate === "string") {
      const cleaned = tightenProse(candidate, maxSentences);
      if (cleaned && !hasUnsupportedFigures(cleaned, allowed)) {
        return { id, title: SECTION_TITLES[id], body: cleaned, source: "ai" as const };
      }
    }
    return { id, title: SECTION_TITLES[id], body: fallback, source: "facts" as const };
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
  };
}
