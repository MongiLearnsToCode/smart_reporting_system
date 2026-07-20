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
