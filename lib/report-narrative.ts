// Prose for each brief section, written from facts alone.
//
// Two jobs: it is the baseline the language model is asked to improve on, and
// it is the fallback when the model is unavailable or returns nothing usable.
// A report must always generate — a client deadline can't depend on an API.

import {
  changePhrase,
  formatAmount,
  formatTotals,
  type BriefComparison,
  type BriefFacts,
  type SectionId,
} from "./report-brief";

export type BriefContext = {
  scopeLabel: string;
  periodLabel: string;
  /** Deltas against the preceding window, when one could be built. */
  comparison?: BriefComparison | null;
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
  const period = periodPhrase(ctx.periodLabel);

  // Open on what was achieved, not on how much was logged. An entry count
  // measures use of this tool, not the state of the business, and it is the
  // single most common way a report opens on something the reader can't act on.
  //
  // Deliberately no deliverable names here: Progress lists them a few lines
  // below, and an executive summary that repeats the section under it is twice
  // the length for the same information.
  if (facts.tasks.completed > 0) {
    const wip = facts.tasks.inProgress;
    parts.push(
      `${ctx.scopeLabel} completed ${plural(facts.tasks.completed, "item")} ${period}` +
        (wip > 0 ? `, with ${plural(wip, "item")} still in progress.` : "."),
    );
  } else if (facts.deliverables.length) {
    parts.push(`${ctx.scopeLabel} delivered ${joinList(facts.deliverables, 2)} ${period}.`);
  } else {
    // Nothing was finished. Say so plainly rather than dressing activity up as
    // achievement — where the work went is the honest answer.
    const categories = categoryPhrase(facts);
    parts.push(
      `${ctx.scopeLabel} logged ${plural(facts.entryCount, "entry", "entries")} ${period} with nothing yet completed` +
        (categories ? `, the work concentrated in ${categories}.` : "."),
    );
  }

  const cmp = ctx.comparison;
  if (facts.income.length && facts.spend.length) {
    parts.push(
      `Income of ${formatTotals(facts.income)} ran against ${formatTotals(facts.spend)} of spend` +
        `${comparisonClause(facts.spend, cmp?.spend)}.`,
    );
  } else if (facts.spend.length) {
    parts.push(`Spend totalled ${withComparison(facts.spend, cmp?.spend)}.`);
  } else if (facts.income.length) {
    parts.push(`Income totalled ${withComparison(facts.income, cmp?.income)}.`);
  }

  if (facts.blockedItems.length > 0) {
    parts.push(
      `${plural(facts.blockedItems.length, "item")} ${facts.blockedItems.length === 1 ? "needs" : "need"} a decision before work continues.`,
    );
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
  // Blockers are named once, in the decisions section. Listing them here as
  // well was the same two sentences twice in a one-page document.
  if (facts.clients.length) {
    parts.push(`Client activity covered ${joinList(facts.clients, 3)}.`);
  }

  return compose(parts);
}

/**
 * ", down 31% from USD 6,100" — a trailing clause rather than a wrapper, so a
 * caller can put it at the end of its sentence instead of in the middle. The
 * wrapper form produced "ran against USD 2,827, down 31% from USD 4,100 of
 * spend", which strands the noun the figure belongs to.
 *
 * Empty when there is nothing to compare against, so a first report reads
 * normally rather than apologising for its own novelty.
 */
function comparisonClause(
  totals: { currency: string; amount: number }[],
  deltas: BriefComparison["spend"] | undefined,
): string {
  if (!deltas?.length || totals.length !== 1) return "";
  const delta = deltas.find((d) => d.currency === totals[0].currency);
  const phrase = delta ? changePhrase(delta.changePct) : null;
  if (!delta || !phrase) return "";
  return phrase === "level with"
    ? ", level with the preceding period"
    : `, ${phrase} ${formatAmount(delta.previous, delta.currency)}`;
}

/** The figure with its direction of travel, for use mid-sentence. */
function withComparison(
  totals: { currency: string; amount: number }[],
  deltas: BriefComparison["spend"] | undefined,
): string {
  return formatTotals(totals) + comparisonClause(totals, deltas);
}

function financials(facts: BriefFacts, ctx: BriefContext): string {
  const parts: string[] = [];
  const cmp = ctx.comparison;

  if (facts.spend.length) {
    const top = facts.spendByCategory[0];
    // A share, not just a leader. "Led by Finance" is true of almost every
    // month; "Finance took 64% of it" is the sentence with a decision in it.
    const lead = facts.concentration
      ? `, ${facts.concentration.share}% of it ${facts.concentration.category}.`
      : top
        ? `, led by ${top.category}.`
        : ".";
    parts.push(`Spend totalled ${withComparison(facts.spend, cmp?.spend)}${lead}`);
  }
  if (facts.income.length) {
    parts.push(`Income totalled ${withComparison(facts.income, cmp?.income)}.`);
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
  // Blocked items deliberately do not appear here: they belong to the
  // decisions section, which is about what the reader has to do. Repeating
  // them in both is what turns a call to action back into background noise.
  const parts: string[] = [];
  const { open, inProgress } = facts.tasks;

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

/** The most decisions to put in front of a reader before it stops being a list of asks. */
export const MAX_DECISIONS = 3;

function decisions(facts: BriefFacts): string {
  const count = Math.min(facts.blockedItems.length, MAX_DECISIONS);
  if (count === 0) return "";
  const overflow = facts.blockedItems.length - count;
  const oldest = facts.blockedAging[0];
  // The age is the argument. "Two items are blocked" is a status; "the oldest
  // has been waiting 21 days" is why the reader should act today.
  const age = oldest && oldest.days >= 2
    ? ` The oldest has been waiting ${oldest.days} days.`
    : "";
  return (
    sentenceCase(
      `${plural(count, "item")} ${count === 1 ? "is" : "are"} held up pending a decision` +
        (overflow > 0 ? `, of ${countWord(facts.blockedItems.length)} outstanding.` : "."),
    ) + age
  );
}

/** The asks themselves, verbatim from the user's own entries, with their age. */
export function decisionItems(facts: BriefFacts): string[] {
  const ages = new Map(facts.blockedAging.map((a) => [a.item, a.days]));
  return facts.blockedItems.slice(0, MAX_DECISIONS).map((item) => {
    const days = ages.get(item);
    return sentenceCase(item) + (days !== undefined && days >= 2 ? ` — open ${days} days` : "");
  });
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
      return financials(facts, ctx);
    case "next_steps":
      return nextSteps(facts);
    case "decisions":
      return decisions(facts);
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
  "Third person, past tense for what happened, present tense for what is outstanding.",
  // The counting instinct is what made this shallow. Restating the numbers the
  // stat strip already prints costs a sentence and adds nothing; naming the
  // specific thing and what follows from it is the whole job.
  "Say what happened and what it means, not how many things happened. Counts already appear in the summary strip; a sentence that only restates one is wasted.",
  "Name specifics from `notable` — the actual work, client, or amount — rather than describing them in the abstract. Refer to them in your own words; do not quote the entries verbatim.",
  "Where the facts support it, connect a cause to its consequence: what a blocker holds up, what a completion unblocks, what a change in spending reflects.",
  "Two to four sentences per section. Prefer the shorter version whenever it carries the same information — but never drop a specific in order to be shorter.",
  // Loosening the leash for substance let comma splices in. Substance and
  // grammar are not a trade-off; the rule just has to be stated.
  "Every sentence must be a complete sentence ending in a full stop. Never join two independent clauses with a comma.",
  // Money written the model's own way is right and wrong at once: "$8000" in
  // prose beside "USD 8,000" in the stat strip reads as two different numbers.
  'State every figure exactly as it appears in the `figures` list — with its currency code, thousands separators or percent sign. Never use a currency symbol, never write a bare figure like "8000", and never write a percentage without its % sign.',
  // First attempt at this rule said "one figure at most" and the summary
  // collapsed to a single line. What it must not repeat is the *breakdown*,
  // not the substance.
  // The document goes *to* the reader; naming them in the third person inside
  // it is the tell of prose written about a report rather than as one.
  'Never refer to "the reader", "the client" in the abstract, or to the report itself. Name what is needed and who from.',
  "The executive summary covers three things and no more: what was achieved, one headline money figure, and what is needed from the reader. It must not repeat the category breakdown or the per-line amounts — those belong to Financials, and a one-page report cannot afford them twice.",
].join(" ");

/** Every monetary figure the brief may state, already formatted. */
function moneyStrings(facts: BriefFacts): string[] {
  const out: string[] = [];
  if (facts.spend.length) out.push(`spend ${formatTotals(facts.spend)}`);
  if (facts.income.length) out.push(`income ${formatTotals(facts.income)}`);
  if (facts.net.length) out.push(`net ${formatTotals(facts.net)}`);
  for (const row of facts.spendByCategory) {
    out.push(`${row.category} ${row.totals.map((t) => formatAmount(t.amount, t.currency)).join(" and ")}`);
  }
  // Pre-rendered with its unit. Handed the bare number, the model wrote "a
  // share of 74", which is not a quantity of anything.
  if (facts.concentration) {
    out.push(`${facts.concentration.share}% of spend went to ${facts.concentration.category}`);
  }
  for (const a of facts.blockedAging) out.push(`${a.item} blocked ${a.days} days`);
  return out;
}

/** The line that separates one section from the next in the model's reply. */
const SECTION_MARKER = /^\s*###\s*([a-z_]+)\s*$/;

/**
 * Parses the model's reply into sections.
 *
 * Deliberately not JSON. Asking a model for prose inside JSON means asking it
 * to escape its own writing, and it routinely doesn't: a raw line break or an
 * unquoted value made JSON.parse reject the whole document, which discarded
 * every section's narration at once and dropped the report to its template
 * fallback without a word. A marker line has no escaping rules to get wrong,
 * and a malformed section can only cost that section.
 */
export function parseSectionResponse(
  text: string,
  ids: SectionId[],
): Partial<Record<SectionId, string>> {
  const valid = new Set<string>(ids);
  const out: Partial<Record<SectionId, string>> = {};
  let current: SectionId | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current && buffer.length) {
      const body = buffer.join("\n").trim();
      if (body) out[current] = body;
    }
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(SECTION_MARKER);
    if (marker && valid.has(marker[1])) {
      flush();
      current = marker[1] as SectionId;
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
  return out;
}

export function buildSectionPrompt(
  ids: SectionId[],
  facts: BriefFacts,
  ctx: BriefContext,
): { system: string; user: string } {
  return {
    system: [
      BRIEF_STYLE_RULES,
      `Write these sections, in this order: ${ids.join(", ")}.`,
      "Begin each one with its identifier on its own line, prefixed by ###, then that section's prose on the lines below it.",
      "For example:\n### executive_summary\nThe prose for that section.\n\n### progress\nThe prose for that section.",
      "Output nothing else — no JSON, no headings of your own, no commentary.",
    ].join(" "),
    user: JSON.stringify({
      scope: ctx.scopeLabel,
      period: ctx.periodLabel,
      // The prior window's figures, so the model can write about direction of
      // travel rather than a standing total.
      comparison: ctx.comparison ?? null,
      // Every figure pre-rendered with its unit, so the model copies a string
      // rather than formatting a number and losing the % or the currency.
      figures: moneyStrings(facts),
      facts,
    }),
  };
}
