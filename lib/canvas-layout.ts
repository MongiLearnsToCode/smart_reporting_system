// Geometry for the canvas: how wide it is, how far it can grow, and how to
// tidy it up.
//
// The canvas is unbounded to the right. Instead of squeezing every block into
// a fixed twelve columns, the column *width* is fixed (derived once from the
// viewport at the base width) and the column *count* grows to cover whatever
// the user has dragged out there, plus headroom to drag into. The container
// scrolls horizontally past the fold.
//
// Kept free of React so the packing can be tested directly.

/** Columns the canvas is sized to before anything is dragged past the fold. */
export const BASE_COLS = 12;
/** Empty columns kept beyond the furthest block — always somewhere to drop. */
export const HEADROOM_COLS = 6;
/** Gutter between blocks, and the container's own padding. */
export const GRID_MARGIN = 16;
export const ROW_HEIGHT = 56;
/** Below this a column is too narrow to hold a readable block, so the canvas
 *  scrolls sideways rather than shrinking further. */
export const MIN_COL_PX = 68;

export type Cell = { x: number; y: number; w: number; h: number };
export type Placeable = Cell & { i: string; pinned?: boolean };

/**
 * How many columns the grid needs right now: enough for the furthest block,
 * plus headroom, never fewer than the base width.
 */
export function canvasCols(
  items: Pick<Cell, 'x' | 'w'>[],
  base = BASE_COLS,
  headroom = HEADROOM_COLS,
): number {
  let furthest = 0;
  for (const it of items) furthest = Math.max(furthest, it.x + it.w);
  return Math.max(base, furthest + headroom);
}

/**
 * Column width in pixels. Fixed for the life of a viewport size: a block is
 * the same size whether the canvas is twelve columns or ninety.
 */
export function colWidthPx(containerWidth: number, base = BASE_COLS, margin = GRID_MARGIN): number {
  // Mirrors react-grid-layout's calcGridColWidth with containerPadding == margin.
  const usable = containerWidth - margin * (base + 1);
  return Math.max(MIN_COL_PX, usable / base);
}

/** Pixel width to hand react-grid-layout so `cols` columns come out at `colWidth`. */
export function gridWidthPx(cols: number, colWidth: number, margin = GRID_MARGIN): number {
  return colWidth * cols + margin * (cols + 1);
}

/**
 * Repack blocks into a tidy grid: reading order, first free slot, no gaps.
 *
 * Sizes are preserved — this straightens the canvas, it doesn't redesign it.
 * Pinned blocks are obstacles, not cargo: they keep their exact cell and
 * everything else flows around them.
 */
export function autoArrange(
  items: Placeable[],
  cols = BASE_COLS,
  compare: (a: Placeable, b: Placeable) => number = (a, b) => a.y - b.y || a.x - b.x,
): Placeable[] {
  const ordered = [...items].sort(compare);
  // Sparse row map — the canvas is unbounded downwards, so rows are created
  // on demand rather than sized up front.
  const rows = new Map<number, boolean[]>();

  function row(y: number): boolean[] {
    let r = rows.get(y);
    if (!r) { r = new Array(cols).fill(false); rows.set(y, r); }
    return r;
  }
  function occupy(cell: Cell) {
    for (let y = cell.y; y < cell.y + cell.h; y++) {
      const r = row(y);
      // A pinned block can sit beyond the packing width; only the part that
      // overlaps these columns can block anything.
      for (let x = Math.max(0, cell.x); x < Math.min(cols, cell.x + cell.w); x++) r[x] = true;
    }
  }
  function free(x: number, y: number, w: number, h: number): boolean {
    for (let yy = y; yy < y + h; yy++) {
      const r = rows.get(yy);
      if (!r) continue;
      for (let xx = x; xx < x + w; xx++) if (r[xx]) return false;
    }
    return true;
  }

  const placed = new Map<string, Placeable>();
  for (const it of ordered) {
    if (!it.pinned) continue;
    occupy(it);
    placed.set(it.i, it);
  }

  for (const it of ordered) {
    if (it.pinned) continue;
    const w = Math.min(Math.max(1, it.w), cols);
    let done = false;
    for (let y = 0; !done; y++) {
      for (let x = 0; x <= cols - w; x++) {
        if (!free(x, y, w, it.h)) continue;
        const cell = { ...it, x, y, w };
        occupy(cell);
        placed.set(it.i, cell);
        done = true;
        break;
      }
    }
  }

  // Input order out, so callers can diff against what they passed in.
  return items.map((it) => placed.get(it.i) ?? it);
}

/** Blocks whose cell actually moved — the only ones worth a write. */
export function changedCells(before: Placeable[], after: Placeable[]): Placeable[] {
  const prev = new Map(before.map((b) => [b.i, b]));
  return after.filter((a) => {
    const b = prev.get(a.i);
    return !b || b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h;
  });
}
