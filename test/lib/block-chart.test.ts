import { describe, expect, it } from 'vitest';
import {
  axisTicks, bucketSeries, chartForm, compactMoney, grainFor, labelInterval, BARS_MIN_H,
} from '../../lib/block-chart';

const DAY = 86400000;
const at = (iso: string, value: number) => ({ ts: new Date(iso).getTime(), value });

describe('grainFor', () => {
  it('coarsens as the window widens, so a chart never grows 90 bars', () => {
    expect(grainFor(10 * DAY)).toBe('day');
    expect(grainFor(60 * DAY)).toBe('week');
    expect(grainFor(300 * DAY)).toBe('month');
  });
});

describe('bucketSeries', () => {
  it('sums same-period entries into one bar', () => {
    // Two expenses on one day are one day's spending, not two positions on the
    // x axis — which is what plotting a point per log produced.
    const { buckets } = bucketSeries([
      at('2026-07-06T09:00:00Z', 100),
      at('2026-07-06T17:00:00Z', 50),
      at('2026-07-07T09:00:00Z', 30),
    ]);
    expect(buckets.map((b) => b.value)).toEqual([150, 30]);
  });

  it('keeps empty periods so a quiet stretch stays visible as a gap', () => {
    // Dropping empty buckets compresses the gap out of the picture, which is
    // exactly the distortion evenly-spaced per-log points created.
    const { buckets } = bucketSeries([
      at('2026-07-01T09:00:00Z', 100),
      at('2026-07-05T09:00:00Z', 100),
    ]);
    expect(buckets).toHaveLength(5);
    expect(buckets.map((b) => b.value)).toEqual([100, 0, 0, 0, 100]);
  });

  it('groups into weeks starting Monday once the span passes a fortnight', () => {
    const { buckets, grain } = bucketSeries([
      at('2026-07-06T09:00:00Z', 100), // Monday
      at('2026-07-09T09:00:00Z', 40),  // same week
      at('2026-07-27T09:00:00Z', 25),  // 21 days on, past the daily threshold
    ]);
    expect(grain).toBe('week');
    expect(buckets[0].value).toBe(140);
    expect(new Date(buckets[0].startMs).getDay()).toBe(1);
  });

  it('ignores entries with an unusable timestamp or value', () => {
    const { buckets } = bucketSeries([
      { ts: Number.NaN, value: 100 },
      { ts: new Date('2026-07-06T09:00:00Z').getTime(), value: Number.NaN },
      at('2026-07-06T09:00:00Z', 20),
    ]);
    expect(buckets.map((b) => b.value)).toEqual([20]);
  });

  it('returns nothing rather than an empty axis when there is no money', () => {
    expect(bucketSeries([]).buckets).toEqual([]);
  });
});

describe('chartForm', () => {
  it('draws bars when there is room and something to compare', () => {
    expect(chartForm(6, 500, 260)).toBe('bars');
  });

  it('falls back to a sparkline and a total in a panel too small for an axis', () => {
    // A chart whose container is too short for its own axis labels gets a
    // nested scrollbar; the honest answer at that size is a different form.
    expect(chartForm(6, 175, 128)).toBe('sparkline');
    expect(chartForm(6, 175, 400)).toBe('sparkline');
  });

  it('still draws bars in a wide but short panel, which has room for them', () => {
    expect(chartForm(6, 715, 200)).toBe('bars');
  });

  it('does not flip form when the panel is measured either side of the switch', () => {
    // The regression this guards: measuring the plot area rather than the
    // panel made the answer depend on which form was already drawn, because
    // the bar form has a caption the others do not. The chart oscillated.
    for (const h of [BARS_MIN_H - 1, BARS_MIN_H, BARS_MIN_H + 1]) {
      const first = chartForm(6, 500, h);
      expect(chartForm(6, 500, h)).toBe(first);
    }
  });

  it('shows a plain number for a single period — a one-bar chart is a stat', () => {
    expect(chartForm(1, 500, 260)).toBe('stat');
  });

  it('says so when there is nothing at all', () => {
    expect(chartForm(0, 500, 260)).toBe('empty');
  });
});

describe('compactMoney', () => {
  it('shortens without pretending to precision it does not have', () => {
    expect(compactMoney(1250.75)).toBe('1.3k');
    expect(compactMoney(430)).toBe('430');
    expect(compactMoney(2_827_770)).toBe('2.8M');
    expect(compactMoney(0)).toBe('0');
  });

  it('keeps the sign', () => {
    expect(compactMoney(-1500)).toBe('-1.5k');
  });

  it('drops the decimal once the number is wide enough not to need it', () => {
    expect(compactMoney(125_000)).toBe('125k');
  });
});

describe('axisTicks', () => {
  it('tops out at a readable step, not at the raw maximum', () => {
    // An axis labelled 1,473 is a number nobody can measure another bar
    // against; 1.5k is.
    expect(axisTicks(1473)).toEqual([0, 750, 1500]);
  });

  it('always includes zero, so bar lengths are read from a real baseline', () => {
    expect(axisTicks(880)[0]).toBe(0);
  });

  it('degrades to a single tick rather than producing NaN', () => {
    expect(axisTicks(0)).toEqual([0]);
    expect(axisTicks(Number.NaN)).toEqual([0]);
  });
});

describe('labelInterval', () => {
  it('thins labels rather than bars when space is tight', () => {
    expect(labelInterval(4, 500)).toBe(0);
    expect(labelInterval(30, 300)).toBeGreaterThan(0);
  });
});
