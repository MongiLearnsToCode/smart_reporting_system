'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { toast } from 'sonner';
import {
  GripVertical, Pin, PinOff, EyeOff, Eye, Copy, Trash2, Pencil,
  FileText, FileX, ListPlus, Sparkles, Loader2, Repeat, Lock,
  Hash, BarChart3, List, Clock, ScrollText, Check, Plus, X, LayoutGrid, Crosshair,
} from 'lucide-react';
import { logAmount, type Log } from '@/lib/dashboard-utils';
import { getCat } from '@/lib/categories';
import type { ConvexBlockDoc } from '@/utils/convex/adapters';
import { useBlockMutations } from '@/utils/convex/hooks';
import { BlockBody } from '@/components/block-render';
import { csrfFetch } from '@/utils/api/csrf';
import { type Tier, tierAllows, upsellFor } from '@/lib/tiers';
import {
  autoArrange, canvasCols, changedCells, colWidthPx, gridWidthPx,
  BASE_COLS, GRID_MARGIN, ROW_HEIGHT, type Placeable,
} from '@/lib/canvas-layout';

// A category is worth suggesting a block for once it has this much activity.
const SUGGEST_THRESHOLD = 5;
const DISMISS_KEY = 'codex.dismissedSuggestions';

// The six block types, for the conversion picker (spec §5 P1).
type BlockType = 'metric' | 'chart' | 'list' | 'timeline' | 'summary' | 'source_log';
const TYPE_META: { type: BlockType; label: string; Icon: typeof Hash }[] = [
  { type: 'metric', label: 'Metric', Icon: Hash },
  { type: 'chart', label: 'Chart', Icon: BarChart3 },
  { type: 'list', label: 'List', Icon: List },
  { type: 'timeline', label: 'Timeline', Icon: Clock },
  { type: 'summary', label: 'Summary', Icon: FileText },
  { type: 'source_log', label: 'Source', Icon: ScrollText },
];

type LayoutItem = Layout;

export function BlockCanvas({
  blocks,
  logs,
  onViewSource,
  tier = 'free',
  projectId = null,
  currency = null,
}: {
  blocks: ConvexBlockDoc[];
  logs: Log[];
  onViewSource: (block: ConvexBlockDoc) => void;
  tier?: Tier;
  /** The user's default currency; every figure a block totals is stated in it. */
  currency?: string | null;
  /** Scope the canvas is showing; narrows AI summaries to the same logs. */
  projectId?: string | null;
}) {
  const m = useBlockMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const canConvert = tierAllows(tier, 'convert');

  // System-suggested blocks (spec §5 P1): categories with real, recurring
  // activity that no block covers yet. Dismissals persist locally so a declined
  // suggestion doesn't nag across reloads.
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { return new Set(); }
  });
  function dismissSuggestion(category: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(category);
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* storage optional */ }
      return next;
    });
  }
  const suggestions = useMemo(() => {
    const covered = new Set(
      blocks.map((b) => b.queryConfig?.category).filter(Boolean) as string[],
    );
    const counts = new Map<string, { total: number; withAmount: number }>();
    for (const l of logs) {
      if (l.excluded_from_reports || !l.category) continue;
      const e = counts.get(l.category) ?? { total: 0, withAmount: 0 };
      e.total++;
      if (logAmount(l)) e.withAmount++;
      counts.set(l.category, e);
    }
    const out: { category: string; count: number; type: BlockType }[] = [];
    for (const [category, { total, withAmount }] of counts) {
      if (total < SUGGEST_THRESHOLD || covered.has(category) || dismissed.has(category)) continue;
      // Numeric-heavy categories get a chart; everything else a list.
      out.push({ category, count: total, type: withAmount * 2 >= total ? 'chart' : 'list' });
    }
    return out.sort((a, b) => b.count - a.count).slice(0, 4);
  }, [blocks, logs, dismissed]);

  function createSuggested(s: { category: string; type: BlockType }) {
    m.create({ type: s.type, title: s.category, queryConfig: { category: s.category } });
  }
  // Guards the layout write so a click that doesn't move a block is not persisted.
  const draggingRef = useRef(false);

  // Generate the AI narrative for a summary block (spec §4). The route calls
  // Groq and caches the result on the block; the canvas re-renders reactively.
  async function generateSummary(block: ConvexBlockDoc) {
    setSummarizingId(block._id);
    try {
      const res = await csrfFetch('/api/blocks/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: block._id, projectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not generate summary');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate summary');
    } finally {
      setSummarizingId(null);
    }
  }

  const visible = useMemo(() => blocks.filter((b) => b.visible), [blocks]);
  const hidden = useMemo(() => blocks.filter((b) => !b.visible), [blocks]);

  const layout: LayoutItem[] = useMemo(
    () =>
      visible.map((b) => ({
        i: b._id,
        x: b.layout.x,
        y: b.layout.y,
        w: b.layout.w,
        h: b.layout.h,
        minW: 2,
        minH: 2,
        static: b.pinned, // pin locks drag + resize (spec §4)
      })),
    [visible],
  );

  // The canvas is unbounded to the right: columns are a fixed pixel width, and
  // the count grows to cover the furthest block plus headroom. Past the fold
  // the wrapper scrolls sideways rather than compressing anything.
  const [wrapWidth, setWrapWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  // A callback ref, not an effect: the wrapper only mounts once blocks have
  // loaded, so a mount-time effect would run against a ref that is still null
  // and never measure anything.
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    setWrapWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWrapWidth(el.clientWidth));
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  const cols = useMemo(() => canvasCols(layout), [layout]);
  // How far real content — not the headroom — reaches past the base width.
  const beyondFold = useMemo(
    () => Math.max(0, ...layout.map((l) => l.x + l.w)) - BASE_COLS,
    [layout],
  );
  const colWidth = colWidthPx(wrapWidth);
  const gridWidth = gridWidthPx(cols, colWidth);

  // Persist on gesture-end only (resolves spec §11 Q5). Batches the whole layout.
  function persist(next: LayoutItem[]) {
    const byId = new Map(visible.map((b) => [b._id, b]));
    const updates = next
      .filter((l) => {
        const b = byId.get(l.i);
        return b && !b.pinned && (b.layout.x !== l.x || b.layout.y !== l.y || b.layout.w !== l.w || b.layout.h !== l.h);
      })
      .map((l) => ({ id: l.i as any, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }));
    if (updates.length) m.updateLayout({ updates });
  }

  // Jump-to-block. The canvas became unbounded, so a block can now sit past the
  // fold where nothing on screen hints it exists. This is a "go to", not a
  // search: with a handful of titled blocks, all of them visible in one list is
  // faster than typing, and it doubles as the index of what the canvas holds.
  const [indexOpen, setIndexOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function jumpTo(id: string) {
    setIndexOpen(false);
    const el = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
    // scrollIntoView walks every scrollable ancestor, which is what this needs:
    // the block may be off-screen horizontally in the canvas wrapper and
    // vertically in the page at the same time.
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    // Arriving somewhere on a canvas of similar-looking panels needs a target;
    // without the flash you land near the block and still have to find it.
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1400);
  }

  // Straighten the canvas: repack into the base width, gaps closed, sizes kept.
  // Undo restores every cell we touched, so a stray click is cheap to reverse.
  function arrange() {
    const before: Placeable[] = visible.map((b) => ({ i: b._id, ...b.layout, pinned: b.pinned }));
    const moved = changedCells(before, autoArrange(before));
    if (!moved.length) {
      toast('Canvas is already tidy');
      return;
    }
    m.updateLayout({
      updates: moved.map((l) => ({ id: l.i as any, layout: { x: l.x, y: l.y, w: l.w, h: l.h } })),
    });
    const movedIds = new Set(moved.map((l) => l.i));
    const undo = before.filter((b) => movedIds.has(b.i));
    toast(`Arranged ${moved.length} block${moved.length === 1 ? '' : 's'}`, {
      action: {
        label: 'Undo',
        onClick: () => m.updateLayout({
          updates: undo.map((l) => ({ id: l.i as any, layout: { x: l.x, y: l.y, w: l.w, h: l.h } })),
        }),
      },
      duration: 5000,
    });
  }

  async function handleDelete(block: ConvexBlockDoc) {
    await m.softDelete({ id: block._id as any });
    toast('Block deleted', {
      action: { label: 'Undo', onClick: () => m.restore({ id: block._id as any }) },
      duration: 5000,
    });
  }

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 py-16 text-zinc-700">
        <ListPlus size={40} strokeWidth={1.25} className="mb-3" />
        <p className="text-sm font-medium text-zinc-600">Log something to seed your canvas</p>
      </div>
    );
  }

  return (
    <div>
      {suggestions.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-600">Suggested</span>
          {suggestions.map((s) => {
            const cat = getCat(s.category);
            return (
              <div
                key={s.category}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-0.5 pl-2 pr-1 text-[11px]"
              >
                <span className={'h-1.5 w-1.5 rounded-full ' + cat.dot} />
                <button
                  onClick={() => createSuggested(s)}
                  title={`${s.count} ${s.category} logs, no block yet — add a ${s.type}`}
                  className="flex items-center gap-1 text-zinc-300 transition-colors hover:text-white"
                >
                  <Plus size={11} /> {s.category} <span className="text-zinc-500">{s.type}</span>
                </button>
                <button
                  onClick={() => dismissSuggestion(s.category)}
                  title="Dismiss"
                  className="text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {hidden.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-600">Hidden</span>
          {hidden.map((b) => (
            <button
              key={b._id}
              onClick={() => m.setVisible({ id: b._id as any, visible: true })}
              className="flex items-center gap-1 rounded-full border border-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100"
            >
              <Eye size={11} /> {b.title}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length > 1 ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          {beyondFold > 0 ? (
            <span className="text-[11px] text-zinc-600">
              Canvas extends {beyondFold} column{beyondFold === 1 ? '' : 's'} past the fold — scroll right
            </span>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndexOpen((open) => !open)}
              aria-expanded={indexOpen}
              title="Jump to a block, including any parked past the fold"
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              <Crosshair size={12} /> Go to block
              <span className="text-zinc-600">{visible.length}</span>
            </button>
            {indexOpen ? (
              <>
                {/* Click-away, behind the menu but above the canvas. */}
                <div className="fixed inset-0 z-30" onClick={() => setIndexOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                  {visible.map((b) => (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => jumpTo(b._id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
                    >
                      <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + getCat(b.queryConfig?.category ?? '').dot} />
                      <span className="truncate">{b.title}</span>
                      {b.pinned ? <Pin size={10} className="ml-auto shrink-0 text-amber-400" /> : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={arrange}
            title="Pack every block into a tidy grid — sizes kept, pinned blocks left alone"
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <LayoutGrid size={12} /> Auto-arrange
          </button>
        </div>
      ) : null}

      <div ref={wrapRef} className="overflow-x-auto overflow-y-hidden">
      {wrapWidth > 0 ? (
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        width={gridWidth}
        // react-grid-layout uses `width` for arithmetic only — it never sizes
        // its own container. Without this the headroom columns exist in the
        // maths but there is nothing to scroll into and nowhere to drop.
        style={{ width: gridWidth }}
        rowHeight={ROW_HEIGHT}
        margin={[GRID_MARGIN, GRID_MARGIN]}
        draggableHandle=".block-drag-handle"
        draggableCancel=".block-no-drag"
        onDragStart={() => { draggingRef.current = true; }}
        onResizeStart={() => { draggingRef.current = true; }}
        onDragStop={(l: LayoutItem[]) => { persist(l); draggingRef.current = false; }}
        onResizeStop={(l: LayoutItem[]) => { persist(l); draggingRef.current = false; }}
        // Free placement: a block stays where it was dropped, however far out
        // that is. Compaction would drag everything back to the top-left and
        // make the extra columns pointless. Arrange is the deliberate tidy-up.
        compactType={null}
      >
        {visible.map((block) => (
          <div
            key={block._id}
            data-block-id={block._id}
            className={
              'group relative overflow-hidden rounded-xl transition-shadow ' +
              (flashId === block._id ? 'ring-2 ring-blue-500/70' : '')
            }
          >
            {/* Drag handle (spec §4 move) */}
            {!block.pinned ? (
              <div className="block-drag-handle absolute left-2 top-2 z-20 hidden cursor-move rounded-md bg-zinc-800/80 p-1 text-zinc-500 group-hover:block hover:text-zinc-200">
                <GripVertical size={12} />
              </div>
            ) : (
              <div className="absolute left-2 top-2 z-20 rounded-md bg-zinc-800/80 p-1 text-amber-400" title="Pinned">
                <Pin size={12} />
              </div>
            )}

            {/* Controls */}
            <div className="block-no-drag absolute right-2 top-2 z-20 hidden items-center gap-1 group-hover:flex">
              {editingId === block._id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editingTitle.trim()) await m.rename({ id: block._id as any, title: editingTitle.trim() });
                    setEditingId(null);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    autoFocus
                    className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white outline-none"
                  />
                  <button type="submit" className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">Save</button>
                </form>
              ) : convertId === block._id ? (
                <div className="flex items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-900/95 p-0.5">
                  {TYPE_META.map(({ type, label, Icon }) => (
                    <button
                      key={type}
                      type="button"
                      title={type === block.type ? `${label} (current)` : `Convert to ${label}`}
                      onClick={() => {
                        if (type !== block.type) m.convertType({ id: block._id as any, type });
                        setConvertId(null);
                      }}
                      className={
                        'flex items-center rounded-md p-1.5 transition-colors ' +
                        (type === block.type
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200')
                      }
                    >
                      {type === block.type ? <Check size={12} /> : <Icon size={12} />}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {block.type === 'summary' ? (
                    <IconBtn
                      title={block.summary ? 'Regenerate narrative' : 'Generate narrative'}
                      onClick={() => generateSummary(block)}
                      active={summarizingId === block._id}
                    >
                      {summarizingId === block._id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </IconBtn>
                  ) : null}
                  <IconBtn title="View source logs" onClick={() => onViewSource(block)}><FileText size={12} /></IconBtn>
                  <IconBtn
                    title={block.includeInReports ? 'In reports — click to exclude' : 'Excluded — click to include'}
                    onClick={() => m.toggleReport({ id: block._id as any, includeInReports: !block.includeInReports })}
                    active={block.includeInReports}
                  >
                    {block.includeInReports ? <FileText size={12} /> : <FileX size={12} />}
                  </IconBtn>
                  <IconBtn title="Rename" onClick={() => { setEditingId(block._id); setEditingTitle(block.title); }}><Pencil size={12} /></IconBtn>
                  <IconBtn
                    title={canConvert ? 'Convert type' : upsellFor('convert')}
                    onClick={() => {
                      if (canConvert) setConvertId(block._id);
                      else toast(upsellFor('convert'), { description: 'Upgrade to unlock block-to-block conversion.' });
                    }}
                  >
                    {canConvert ? <Repeat size={12} /> : <Lock size={12} />}
                  </IconBtn>
                  <IconBtn title={block.pinned ? 'Unpin' : 'Pin'} onClick={() => m.setPinned({ id: block._id as any, pinned: !block.pinned })}>
                    {block.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </IconBtn>
                  <IconBtn title="Hide" onClick={() => m.setVisible({ id: block._id as any, visible: false })}><EyeOff size={12} /></IconBtn>
                  <IconBtn title="Duplicate" onClick={() => m.duplicate({ id: block._id as any })}><Copy size={12} /></IconBtn>
                  <IconBtn title="Delete" danger onClick={() => handleDelete(block)}><Trash2 size={12} /></IconBtn>
                </>
              )}
            </div>

            <div className="h-full">
              <BlockBody block={block} logs={logs} currency={currency} />
            </div>
          </div>
        ))}
      </GridLayout>
      ) : null}
      </div>
    </div>
  );
}

function IconBtn({
  children, onClick, title, danger, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        'rounded-lg bg-zinc-800/80 p-1.5 transition-colors ' +
        (danger
          ? 'text-zinc-500 hover:bg-red-600 hover:text-white'
          : active
            ? 'text-emerald-400 hover:bg-zinc-700'
            : 'text-zinc-500 hover:bg-zinc-700 hover:text-white')
      }
    >
      {children}
    </button>
  );
}
