// Prose for each brief section, written from facts alone.
//
// Two jobs: it is the baseline the language model is asked to improve on, and
// it is the fallback when the model is unavailable or returns nothing usable.
// A report must always generate — a client deadline can't depend on an API.

import {
  formatTotals,
  type BriefFacts,
  type SectionId,
} from "./report-brief";

export type BriefContext = {
  scopeLabel: string;
  periodLabel: string;
};

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];

/**
 * Counts read as words up to twelve, the usual prose convention. Money and
 * larger values stay numeric so they remain scannable — mixing the two styles
 * inside one sentence ("Two items completed, with 1 blocked") is what makes a
 * document look auto-generated.
 */
export function countWord(count: number): string {
  return Number.isInteger(count) && count >= 0 && count <= 12
    ? NUMBER_WORDS[count]
    : String(count);
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${countWord(count)} ${count === 1 ? singular : pluralForm ?? singular + "s"}`;
}

/** Reads the period naturally in a sentence: "this week", "over the last 30 days". */
export function periodPhrase(label: string): string {
  const lower = label.trim().toLowerCase();
  if (!lower) return "";
  if (lower.startsWith("this ")) return lower;
  if (lower === "quarter") return "this quarter";
  if (lower.startsWith("last ")) return `over the ${lower}`;
  return `over ${lower}`;
}

/**
 * Opens a sentence properly. House style — and every style guide worth the
 * name — avoids starting a sentence with a numeral, so small leading numbers
 * are spelled out. Figures elsewhere in the sentence stay as digits, which is
 * what keeps them scannable.
 */
export function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const leadingNumber = trimmed.match(/^(\d+)(\s)/);
  if (leadingNumber) {
    const word = NUMBER_WORDS[Number(leadingNumber[1])];
    if (word) {
      return (
        word[0].toUpperCase() + word.slice(1) + leadingNumber[2] + trimmed.slice(leadingNumber[0].length)
      );
    }
  }
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

/** Joins section sentences, each opened correctly. */
function compose(parts: string[]): string {
  return parts.map(sentenceCase).filter(Boolean).join(" ");
}

/** "a", "a and b", "a, b and c" — no serial comma, matching UK report style. */
export function joinList(items: string[], max = 3): string {
  const list = items.slice(0, max);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function categoryPhrase(facts: BriefFacts): string {
  const names = facts.categories.slice(0, 3).map((c) => c.category);
  return names.length ? joinList(names) : "";
}

function executiveSummary(facts: BriefFacts, ctx: BriefContext): string {
  const parts: string[] = [];
  const categories = categoryPhrase(facts);
  parts.push(
    `${ctx.scopeLabel} recorded ${plural(facts.entryCount, "entry", "entries")} ${periodPhrase(ctx.periodLabel)}` +
      (categories ? `, concentrated in ${categories}.` : "."),
  );

  if (facts.income.length && facts.spend.length) {
    parts.push(
      `Income of ${formatTotals(facts.income)} ran against ${formatTotals(facts.spend)} of spend.`,
    );
  } else if (facts.spend.length) {
    parts.push(`Spend totalled ${formatTotals(facts.spend)}.`);
  } else if (facts.income.length) {
    parts.push(`Income totalled ${formatTotals(facts.income)}.`);
  }

  if (facts.tasks.completed > 0) {
    const tail = facts.tasks.blocked > 0 ? `, with ${countWord(facts.tasks.blocked)} blocked` : "";
    parts.push(`${plural(facts.tasks.completed, "item")} completed${tail}.`);
  } else if (facts.tasks.blocked > 0) {
    parts.push(`${plural(facts.tasks.blocked, "item")} currently blocked.`);
  }

  return compose(parts);
}

function progress(facts: BriefFacts): string {
  const parts: string[] = [];
  const { completed, inProgress, open, blocked } = facts.tasks;

  if (completed > 0 || inProgress > 0) {
    const bits: string[] = [];
    if (completed > 0) bits.push(`${plural(completed, "item")} completed`);
    if (inProgress > 0) bits.push(`${countWord(inProgress)} in progress`);
    if (open > 0) bits.push(`${countWord(open)} still open`);
    parts.push(`${joinList(bits, 3)}.`);
  } else {
    // Nothing finished this period. Describing the volume of activity is still
    // a truthful account of progress — what's outstanding belongs to Next Steps.
    const categories = categoryPhrase(facts);
    parts.push(
      `Activity spanned ${plural(facts.entryCount, "entry", "entries")}` +
        (categories ? ` across ${categories}.` : "."),
    );
  }

  if (facts.deliverables.length) {
    parts.push(`Delivered: ${joinList(facts.deliverables, 3)}.`);
  }
  if (blocked > 0 && facts.blockedItems.length) {
    parts.push(`Blocked on ${joinList(facts.blockedItems, 2)}.`);
  }
  if (facts.clients.length) {
    parts.push(`Client activity covered ${joinList(facts.clients, 3)}.`);
  }

  return compose(parts);
}

function financials(facts: BriefFacts): string {
  const parts: string[] = [];

  if (facts.spend.length) {
    const top = facts.spendByCategory[0];
    parts.push(
      `Spend totalled ${formatTotals(facts.spend)}` +
        (top ? `, led by ${top.category}.` : "."),
    );
  }
  if (facts.income.length) {
    parts.push(`Income totalled ${formatTotals(facts.income)}.`);
  }
  if (facts.spend.length && facts.income.length && facts.net.length) {
    const negative = facts.net.every((n) => n.amount < 0);
    parts.push(
      negative
        ? `That leaves a net outflow of ${formatTotals(facts.net.map((n) => ({ ...n, amount: Math.abs(n.amount) })))}.`
        : `That leaves a net position of ${formatTotals(facts.net)}.`,
    );
  }

  return compose(parts);
}

function nextSteps(facts: BriefFacts): string {
  const parts: string[] = [];
  const { open, inProgress, blocked } = facts.tasks;

  if (blocked > 0) {
    parts.push(
      `${plural(blocked, "item")} blocked` +
        (facts.blockedItems.length ? `: ${joinList(facts.blockedItems, 2)}.` : " and needing a decision."),
    );
  }
  if (open + inProgress > 0) {
    parts.push(
      `${plural(open + inProgress, "item")} outstanding` +
        (facts.openItems.length ? `, including ${joinList(facts.openItems, 2)}.` : "."),
    );
  }
  if (facts.risks.length) {
    parts.push(`Risks to watch: ${joinList(facts.risks, 2)}.`);
  }

  return compose(parts);
}

/** Factual prose for one section, with no model involvement. */
export function narrateSection(
  id: SectionId,
  facts: BriefFacts,
  ctx: BriefContext,
): string {
  switch (id) {
    case "executive_summary":
      return executiveSummary(facts, ctx);
    case "progress":
      return progress(facts);
    case "financials":
      return financials(facts);
    case "next_steps":
      return nextSteps(facts);
  }
}

/**
 * The style contract sent to the model. Kept beside the fallback so the two
 * stay describable in the same terms.
 */
export const BRIEF_STYLE_RULES = [
  "You write executive briefs for a consulting firm. Tight, factual prose in complete sentences.",
  "Use ONLY the facts in the JSON provided. Never invent figures, names, dates or outcomes.",
  "Every figure you state must appear verbatim in the facts. If a fact is absent, omit the claim.",
  "No preamble, no sign-off, no headings, no bullet points, no markdown, no questions to the reader.",
  'Never write "it is worth noting", "overall", "in summary", "I hope this helps" or similar filler.',
  "Two to four sentences per section. Prefer the shorter version whenever it carries the same information.",
  "Third person, past tense for what happened, present tense for what is outstanding.",
].join(" ");

export function buildSectionPrompt(
  ids: SectionId[],
  facts: BriefFacts,
  ctx: BriefContext,
): { system: string; user: string } {
  return {
    system: [
      BRIEF_STYLE_RULES,
      `Return ONLY a JSON object whose keys are exactly: ${ids.join(", ")}.`,
      "Each value is the section's prose as a single plain string.",
    ].join(" "),
    user: JSON.stringify({
      scope: ctx.scopeLabel,
      period: ctx.periodLabel,
      facts,
    }),
  };
}
