import { describe, expect, it } from 'vitest';
import {
  autoArrange, canvasCols, changedCells, colWidthPx, gridWidthPx,
  BASE_COLS, GRID_MARGIN, HEADROOM_COLS, MIN_COL_PX, type Placeable,
} from '../../lib/canvas-layout';

const at = (i: string, x: number, y: number, w: number, h: number, pinned = false): Placeable =>
  ({ i, x, y, w, h, pinned });

/** react-grid-layout's own calcGridColWidth, with containerPadding == margin. */
function rglColWidth(containerWidth: number, cols: number): number {
  return (containerWidth - GRID_MARGIN * (cols - 1) - GRID_MARGIN * 2) / cols;
}

/** Every cell a block covers, as "x,y" keys. */
function cells(items: Placeable[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    for (let y = it.y; y < it.y + it.h; y++) {
      for (let x = it.x; x < it.x + it.w; x++) out.push(`${x},${y}`);
    }
  }
  return out;
}

function expectNoOverlap(items: Placeable[]) {
  const all = cells(items);
  expect(new Set(all).size).toBe(all.length);
}

describe('canvasCols', () => {
  it('keeps room to the right even when the base grid is full edge to edge', () => {
    // Without headroom react-grid-layout clamps x to cols - w, so a full row
    // would be a wall: there would be no column to drag the first block into
    // and the canvas could never grow at all.
    expect(canvasCols([at('a', 0, 0, 6, 4), at('b', 6, 0, 6, 4)])).toBe(BASE_COLS + HEADROOM_COLS);
  });

  it('grows past the fold to cover the furthest block, plus headroom', () => {
    // A block dragged out to column 40 must not be the last column: there has
    // to be empty grid beyond it or the canvas has an edge.
    expect(canvasCols([at('a', 0, 0, 4, 4), at('b', 36, 0, 4, 4)])).toBe(40 + HEADROOM_COLS);
  });

  it('is unbounded — an arbitrarily distant block is still covered', () => {
    expect(canvasCols([at('a', 900, 0, 4, 4)])).toBe(904 + HEADROOM_COLS);
  });

  it('never returns fewer columns than the base, whatever it is handed', () => {
    expect(canvasCols([])).toBe(BASE_COLS);
  });
});

describe('column geometry', () => {
  it('gives back the width react-grid-layout would compute for the base grid', () => {
    const container = 1400;
    expect(colWidthPx(container)).toBeCloseTo(rglColWidth(container, BASE_COLS), 6);
  });

  it('keeps a block the same pixel size as the canvas grows', () => {
    // The point of the whole exercise: dragging a block out to column 60 must
    // not shrink every other block to fit 60 columns on screen.
    const colWidth = colWidthPx(1400);
    for (const cols of [BASE_COLS, 20, 60, 300]) {
      expect(rglColWidth(gridWidthPx(cols, colWidth), cols)).toBeCloseTo(colWidth, 6);
    }
  });

  it('stops shrinking columns once they are too narrow to read, and scrolls instead', () => {
    const phone = 380;
    expect(colWidthPx(phone)).toBe(MIN_COL_PX);
    expect(gridWidthPx(BASE_COLS, colWidthPx(phone))).toBeGreaterThan(phone);
  });
});

describe('autoArrange', () => {
  it('closes the gaps a freely dragged canvas leaves behind', () => {
    const before = [at('a', 0, 0, 6, 4), at('b', 6, 9, 6, 4), at('c', 0, 20, 6, 4)];
    const after = autoArrange(before);

    expect(after.map((b) => [b.x, b.y])).toEqual([[0, 0], [6, 0], [0, 4]]);
  });

  it('keeps every block its own size', () => {
    const before = [at('a', 0, 0, 3, 2), at('b', 5, 7, 6, 4), at('c', 0, 30, 4, 5)];
    for (const b of autoArrange(before)) {
      const original = before.find((o) => o.i === b.i)!;
      expect([b.w, b.h]).toEqual([original.w, original.h]);
    }
  });

  it('packs in reading order — top-left first, whatever order it is handed', () => {
    const before = [at('last', 0, 30, 4, 2), at('first', 0, 0, 4, 2), at('middle', 8, 0, 4, 2)];
    const after = autoArrange(before);
    const byId = new Map(after.map((b) => [b.i, b]));

    expect([byId.get('first')!.x, byId.get('first')!.y]).toEqual([0, 0]);
    expect([byId.get('middle')!.x, byId.get('middle')!.y]).toEqual([4, 0]);
    expect([byId.get('last')!.x, byId.get('last')!.y]).toEqual([8, 0]);
  });

  it('never overlaps blocks of mismatched heights', () => {
    // The jagged-canvas case: a tall block beside short ones. Packing must
    // flow the short ones around it rather than through it.
    const before = [
      at('tall', 0, 0, 6, 8), at('s1', 6, 0, 6, 2), at('s2', 6, 3, 6, 2),
      at('s3', 6, 7, 6, 2), at('s4', 0, 12, 4, 3),
    ];
    const after = autoArrange(before);

    expectNoOverlap(after);
    expect(after.every((b) => b.x + b.w <= BASE_COLS)).toBe(true);
  });

  it('leaves pinned blocks exactly where they are and flows the rest around them', () => {
    const pinned = at('pin', 4, 0, 4, 4, true);
    const after = autoArrange([at('a', 0, 6, 6, 2), pinned, at('b', 0, 9, 6, 2)]);
    const byId = new Map(after.map((b) => [b.i, b]));

    expect([byId.get('pin')!.x, byId.get('pin')!.y]).toEqual([4, 0]);
    expectNoOverlap(after);
    // The 6-wide blocks cannot fit beside a pinned block at columns 4–7, so
    // they stack underneath rather than colliding with it.
    expect(byId.get('a')!.y).toBeGreaterThanOrEqual(4);
  });

  it('treats a pinned block parked past the fold as no obstacle at all', () => {
    const after = autoArrange([at('far', 40, 0, 4, 4, true), at('a', 0, 5, 6, 2)]);
    const byId = new Map(after.map((b) => [b.i, b]));

    expect([byId.get('far')!.x, byId.get('far')!.y]).toEqual([40, 0]);
    expect([byId.get('a')!.x, byId.get('a')!.y]).toEqual([0, 0]);
  });

  it('pulls a block wider than the grid back inside it', () => {
    const [wide] = autoArrange([at('wide', 30, 0, 40, 3)]);
    expect(wide.w).toBe(BASE_COLS);
    expect([wide.x, wide.y]).toEqual([0, 0]);
  });

  it('returns blocks in the order it was given, so callers can diff', () => {
    const before = [at('a', 0, 9, 4, 2), at('b', 0, 0, 4, 2), at('c', 6, 4, 4, 2)];
    expect(autoArrange(before).map((b) => b.i)).toEqual(['a', 'b', 'c']);
  });

  it('leaves an already-tidy canvas untouched', () => {
    const before = [at('a', 0, 0, 6, 4), at('b', 6, 0, 6, 4), at('c', 0, 4, 12, 3)];
    expect(changedCells(before, autoArrange(before))).toEqual([]);
  });
});

describe('changedCells', () => {
  it('reports only the blocks whose cell actually moved', () => {
    const before = [at('a', 0, 0, 4, 2), at('b', 4, 0, 4, 2)];
    const after = [at('a', 0, 0, 4, 2), at('b', 8, 0, 4, 2)];

    expect(changedCells(before, after).map((b) => b.i)).toEqual(['b']);
  });

  it('counts a resize as a change, not just a move', () => {
    expect(changedCells([at('a', 0, 0, 4, 2)], [at('a', 0, 0, 4, 5)])).toHaveLength(1);
  });
});
