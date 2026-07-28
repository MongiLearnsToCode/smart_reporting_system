// Turns a block's money entries into something a chart can honestly draw.
//
// The old chart plotted one point per log, evenly spaced, joined by a smoothed
// line. Three separate lies in one picture: two expenses on the same day became
// two positions on the x axis, a three-week gap rendered identically to a
// same-day pair, and the spline invented values between transactions that never
// existed. Spending is discrete events, so it is bucketed into periods and
// drawn as bars — a line asserts continuity between readings, which money
// movements do not have.

export type Point = { ts: number; value: number };
export type Bucket = { label: string; value: number; startMs: number };
export type Grain = "day" | "week" | "month";

const DAY = 86400000;

/** Coarser buckets as the window widens, so a chart never has 90 bars. */
export function grainFor(spanMs: number): Grain {
  if (spanMs <= 16 * DAY) return "day";
  if (spanMs <= 120 * DAY) return "week";
  return "month";
}

function startOf(ts: number, grain: Grain): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  if (grain === "day") return d.getTime();
  if (grain === "week") {
    // Monday-start weeks; getDay() is 0 for Sunday.
    const back = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - back);
    return d.getTime();
  }
  d.setDate(1);
  return d.getTime();
}

function labelFor(startMs: number, grain: Grain): string {
  const d = new Date(startMs);
  if (grain === "month") return d.toLocaleDateString(undefined, { month: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Sums points into consecutive periods.
 *
 * Empty periods inside the range are kept at zero: a fortnight with no spend is
 * a fact about the business, and dropping those buckets would compress the gap
 * out of the picture — exactly the distortion this replaces.
 */
export function bucketSeries(points: Point[]): { buckets: Bucket[]; grain: Grain } {
  const usable = points.filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value));
  if (usable.length === 0) return { buckets: [], grain: "day" };

  const times = usable.map((p) => p.ts);
  const grain = grainFor(Math.max(...times) - Math.min(...times));

  const totals = new Map<number, number>();
  for (const p of usable) {
    const key = startOf(p.ts, grain);
    totals.set(key, (totals.get(key) ?? 0) + p.value);
  }

  const first = startOf(Math.min(...times), grain);
  const last = startOf(Math.max(...times), grain);
  const buckets: Bucket[] = [];
  const cursor = new Date(first);
  // Guard against a pathological range producing thousands of empty buckets.
  for (let i = 0; cursor.getTime() <= last && i < 400; i++) {
    const key = cursor.getTime();
    buckets.push({ label: labelFor(key, grain), value: totals.get(key) ?? 0, startMs: key });
    if (grain === "day") cursor.setDate(cursor.getDate() + 1);
    else if (grain === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return { buckets, grain };
}

/**
 * Axis and hero figures, shortened. Hand-rolled rather than Intl.NumberFormat
 * with notation:"compact" because that output shifts with the host's ICU
 * version, and an axis label that differs between two users' browsers is not a
 * shared reference.
 */
export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const round = (n: number) => (n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());
  if (abs >= 1e9) return `${sign}${round(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${round(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${round(abs / 1e3)}k`;
  return `${sign}${Math.round(abs)}`;
}

/** Panel space a bar chart needs before its axes stop competing with its bars. */
export const BARS_MIN_W = 280;
export const BARS_MIN_H = 190;

/**
 * Which form the block can carry at its current size.
 *
 * Measured against the whole panel, never the plot area inside it. The bar form
 * carries a units caption the smaller forms don't, so a plot-area measurement
 * lands on a different side of the threshold depending on which form is already
 * drawn — and the chart flips between the two indefinitely. The panel's size is
 * independent of what is drawn in it, which is what makes this a decision
 * rather than a loop.
 *
 * A block is resizable down to roughly 175×128px, where an axis band does not
 * fit — and a chart whose container is too short for its own axis labels grows
 * a nested scrollbar. Below the threshold the honest answer is not a smaller
 * chart but a different form: the total, with a sparkline for shape. A single
 * bucket is a number too; a one-bar bar chart is a stat tile with extra ink.
 */
export function chartForm(
  bucketCount: number,
  panelWidth: number,
  panelHeight: number,
): "bars" | "sparkline" | "stat" | "empty" {
  if (bucketCount === 0) return "empty";
  if (bucketCount === 1) return "stat";
  if (panelHeight < BARS_MIN_H || panelWidth < BARS_MIN_W) return "sparkline";
  return "bars";
}

/** Three gridline values — zero, midpoint, a rounded top. Enough to read against. */
export function axisTicks(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  // Round the top up to a readable step so the label is 1.5k, not 1,473.
  const top = Math.ceil(max / (magnitude / 2)) * (magnitude / 2);
  return [0, top / 2, top];
}

/**
 * How many x labels fit without collision, as a recharts `interval`.
 * Every bar keeps its bar; only the labels thin out.
 */
export function labelInterval(bucketCount: number, width: number): number {
  const perLabel = 46;
  const room = Math.max(2, Math.floor(width / perLabel));
  return Math.max(0, Math.ceil(bucketCount / room) - 1);
}
