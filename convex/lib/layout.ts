import { Doc } from '../_generated/dataModel';

export const GRID_COLS = 12;
export const MIN_W = 2;
export const MIN_H = 2;

type Layout = { x: number; y: number; w: number; h: number };

// Placement for auto-created / seeded blocks (resolves spec §11 Q3): append to
// the next free row below everything currently on the canvas.
export function nextFreeRow(blocks: Pick<Doc<'canvasBlocks'>, 'layout' | 'deletedAt' | 'visible'>[]): number {
  let maxBottom = 0;
  for (const b of blocks) {
    if (b.deletedAt) continue;
    const bottom = b.layout.y + b.layout.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

// Packs a list of blocks left-to-right across the 12-col grid, wrapping rows.
// Used to lay out a starter canvas (spec §6) without overlaps.
export function packGrid(types: string[]): Layout[] {
  const out: Layout[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const type of types) {
    const { w, h } = defaultLayoutFor(type, 0);
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    out.push({ x, y, w, h });
    x += w;
    rowH = Math.max(rowH, h);
  }
  return out;
}

// Default size per block type, tuned so starter canvases read well.
export function defaultLayoutFor(type: string, y: number): Layout {
  switch (type) {
    case 'metric':
      return { x: 0, y, w: 3, h: 2 };
    case 'chart':
      return { x: 0, y, w: 6, h: 4 };
    case 'summary':
      return { x: 0, y, w: 6, h: 4 };
    case 'timeline':
      return { x: 0, y, w: 6, h: 5 };
    case 'source_log':
      return { x: 0, y, w: 4, h: 5 };
    case 'list':
    default:
      return { x: 0, y, w: 4, h: 4 };
  }
}
