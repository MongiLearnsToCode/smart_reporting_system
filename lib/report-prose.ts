// Turns model output into executive-brief prose.
//
// Language models pad: they open with "Certainly!", close with "Let me know if
// you need anything else", and hedge everything in between. A client-facing
// brief can't carry any of that, and prompting alone doesn't reliably suppress
// it — so the output is stripped deterministically here.

/** Conversational openers. Anchored to the start so body text is untouched. */
const PREAMBLE = [
  /^(?:certainly|sure|of course|absolutely|great question|no problem)\b[!,.:]*\s*/i,
  /^here(?:'s| is| are)\b[^.:!?]{0,80}:\s*/i,
  /^(?:as requested|as you asked|per your request)\b[,:]?\s*/i,
  /^(?:below|the following)\s+is\b[^.:!?]{0,80}:\s*/i,
];

/** Sign-offs and offers of further help. */
const SIGNOFF = [
  /\s*let me know if[^.!?]*[.!?]?\s*$/i,
  /\s*i hope (?:this|that) helps[^.!?]*[.!?]?\s*$/i,
  /\s*(?:please )?feel free to[^.!?]*[.!?]?\s*$/i,
  /\s*(?:please )?don'?t hesitate to[^.!?]*[.!?]?\s*$/i,
  /\s*if you (?:have|need)[^.!?]*(?:questions|assistance|help)[^.!?]*[.!?]?\s*$/i,
];

/**
 * Hedges and throat-clearing. Removed wherever a sentence starts, since the
 * model reintroduces them mid-paragraph as readily as at the top.
 */
// Evaluative adjectives a report should not be applying to its own contents.
// "A notable income of USD 8,000" is the same sentence as "income of
// USD 8,000" with a judgement bolted on that the figure has to earn itself.
const PUFFERY = [
  /\b(?:significant|notable|substantial|considerable|impressive|remarkable|key)\s+(?=[a-z])/gi,
  /\bachieved a (?:significant |major |key )?milestone with\s+/gi,
];

const HEDGES = [
  /\bit(?:'s| is) worth noting that\s+/gi,
  /\bit should be noted that\s+/gi,
  /\bit(?:'s| is) important to note that\s+/gi,
  /\bit appears that\s+/gi,
  /\bit seems that\s+/gi,
  /\bplease note that\s+/gi,
  /\bas we can see,?\s+/gi,
  /\b(?:in summary|in conclusion|to summarise|to summarize|overall|essentially|basically|notably|importantly),\s+/gi,
];

/** Strips markdown so the PDF renders plain typographic prose. */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Restores sentence case. Removing a hedge promotes the word behind it to the
 * start of a sentence ("...shipped. it should be noted that one slipped" →
 * "...shipped. one slipped"), so capitalisation is reapplied after stripping
 * rather than only at the start of the text.
 */
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, char: string) =>
    lead + char.toUpperCase(),
  );
}

/** Removes filler without touching the substance between it. */
export function stripFiller(raw: string): string {
  if (!raw) return "";
  let text = stripMarkdown(raw).replace(/\r/g, "");

  // Preambles can stack ("Certainly! Here is the summary:").
  for (let pass = 0; pass < PREAMBLE.length; pass++) {
    const before = text;
    for (const pattern of PREAMBLE) text = text.replace(pattern, "");
    text = text.trimStart();
    if (text === before) break;
  }

  let changed = true;
  while (changed) {
    const before = text;
    for (const pattern of SIGNOFF) text = text.replace(pattern, "");
    changed = text !== before;
  }

  for (const pattern of HEDGES) text = text.replace(pattern, "");
  for (const pattern of PUFFERY) text = text.replace(pattern, "");

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return capitalizeSentences(text);
}

/** Splits on sentence terminators, keeping decimals and abbreviations intact. */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(“"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Full pipeline: strip filler, cap length, guarantee terminal punctuation.
 * `maxSentences` is what keeps sections tight rather than essayistic.
 */
export function tightenProse(raw: string, maxSentences = 4): string {
  const stripped = stripFiller(raw);
  if (!stripped) return "";

  const sentences = splitSentences(stripped).slice(0, Math.max(1, maxSentences));
  let text = sentences.join(" ").trim();
  // A truncated trailing fragment still needs to read as a finished sentence.
  if (text && !/[.!?]$/.test(text)) text += ".";
  return text;
}

/** True when text still carries filler — used to assert prompt quality in tests. */
export function hasFiller(text: string): boolean {
  return (
    PREAMBLE.some((p) => p.test(text)) ||
    SIGNOFF.some((p) => p.test(text)) ||
    HEDGES.some((p) => {
      p.lastIndex = 0;
      return p.test(text);
    })
  );
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
