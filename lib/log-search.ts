// How the log feed narrows: search, then the filters that were already there.
//
// Search doesn't replace the category and client chips, it composes with them.
// A user who has filtered to Northwind and then types "printer" means printer
// within Northwind — a search that quietly discarded their filter would be
// answering a question they didn't ask.
//
// Every predicate here is idempotent, so applying them to a list that has
// already been narrowed the same way is a no-op. That is what lets the caller
// run one filter pass over either the loaded feed or a set of server search
// results without tracking which narrowing each has already had.

import { logClients, type Log } from "./dashboard-utils";

export type FeedFilters = {
  category: string | null;
  client: string | null;
  /** Time-travel cutoff in ms; null means "now". */
  snapshotMs: number | null;
};

export function filterFeed(logs: Log[], filters: FeedFilters): Log[] {
  const { category, client, snapshotMs } = filters;
  return logs.filter((log) => {
    if (category && log.category !== category) return false;
    if (client && !logClients(log).includes(client)) return false;
    if (snapshotMs !== null) {
      const at = new Date(log.timestamp).getTime();
      // An unparseable timestamp is kept: dropping an entry because its date
      // is malformed would hide it from search with no way to find out why.
      if (Number.isFinite(at) && at > snapshotMs) return false;
    }
    return true;
  });
}

/** The cutoff the time-travel slider represents, or null at "Now". */
export function snapshotFor(timeValue: number, now = Date.now()): number | null {
  return timeValue >= 100 ? null : now - (100 - timeValue) * 86400000;
}

/**
 * Whether a query should hit the index. Trimmed-empty is not a search — an
 * empty box must read as "no search applied", never as a filter that returned
 * nothing.
 */
export function isSearchable(query: string): boolean {
  return query.trim().length > 0;
}

/** How much of an entry the feed shows in one row. */
export const PREVIEW_LEN = 80;

/**
 * The slice of an entry to show in a result row.
 *
 * Without a query this is the opening of the text, as before. With one, the
 * window slides to include the first match — on a long entry the match is
 * rarely in the first line, and a search result that doesn't show the matched
 * words reads as a wrong result even when it's right.
 */
export function previewFor(text: string, query?: string): string {
  if (text.length <= PREVIEW_LEN) return text;

  const terms = query ? query.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
  let at = -1;
  for (const term of terms) {
    const found = text.toLowerCase().indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1 || at < PREVIEW_LEN) return text.slice(0, PREVIEW_LEN) + "…";

  // Keep a little text before the match so it reads as a sentence fragment
  // rather than starting mid-word.
  const start = Math.max(0, at - 24);
  const end = Math.min(text.length, start + PREVIEW_LEN);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

/**
 * Splits text around the matched terms so a result can show why it matched.
 * Case-insensitive, whole-query-terms, longest first so overlapping terms
 * don't produce nested fragments.
 */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const terms = Array.from(new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean)))
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text, match: false }];

  const lower = text.toLowerCase();
  // Mark every matched character, then coalesce runs. Simpler to reason about
  // than splicing overlapping ranges, and it cannot drop or duplicate text.
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      for (let i = at; i < at + term.length; i++) marked[i] = true;
      from = at + term.length;
    }
  }

  const parts: { text: string; match: boolean }[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[start]) {
      parts.push({ text: text.slice(start, i), match: marked[start] });
      start = i;
    }
  }
  return parts.length ? parts : [{ text, match: false }];
}
