'use client';

import { useMemo, useRef, useState } from 'react';
import * as RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { toast } from 'sonner';
import {
  GripVertical, Pin, PinOff, EyeOff, Eye, Copy, Trash2, Pencil,
  FileText, FileX, ListPlus, Sparkles, Loader2,
} from 'lucide-react';
import { type Log } from '@/lib/dashboard-utils';
import type { ConvexBlockDoc } from '@/utils/convex/adapters';
import { useBlockMutations } from '@/utils/convex/hooks';
import { BlockBody } from '@/components/block-render';
import { csrfFetch } from '@/utils/api/csrf';

const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
const ROW_HEIGHT = 56;
type LayoutItem = RGL.Layout;

export function BlockCanvas({
  blocks,
  logs,
  onViewSource,
}: {
  blocks: ConvexBlockDoc[];
  logs: Log[];
  onViewSource: (block: ConvexBlockDoc) => void;
}) {
  const m = useBlockMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
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
        body: JSON.stringify({ blockId: block._id }),
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

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        draggableHandle=".block-drag-handle"
        draggableCancel=".block-no-drag"
        onDragStart={() => { draggingRef.current = true; }}
        onResizeStart={() => { draggingRef.current = true; }}
        onDragStop={(l: LayoutItem[]) => { persist(l); draggingRef.current = false; }}
        onResizeStop={(l: LayoutItem[]) => { persist(l); draggingRef.current = false; }}
        compactType="vertical"
      >
        {visible.map((block) => (
          <div key={block._id} className="group relative overflow-hidden">
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
              <BlockBody block={block} logs={logs} />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
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
