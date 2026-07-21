'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Sparkles, ExternalLink, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  ToggleGroup, ToggleGroupItem,
  Button, Checkbox, Input, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { BlockBody } from "@/components/block-render";
import { getCat } from "@/lib/categories";
import { formatTimeAgo, type Log } from "@/lib/dashboard-utils";
import type { ConvexBlockDoc } from "@/utils/convex/adapters";

const PERIODS = [
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 90, label: "Quarter" },
] as const;

// Offscreen capture geometry — one fixed width, height scaled from the block's
// grid rows so an exported block roughly matches its on-canvas footprint.
const CAPTURE_W = 600;
function captureHeight(b: ConvexBlockDoc) {
  return Math.min(520, Math.max(200, b.layout.h * 58));
}

function periodLabel(days: number) {
  return PERIODS.find((p) => p.days === days)?.label ?? `Last ${days} days`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </p>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function ReportsModal({ blocks, logs, onClose }: {
  blocks: ConvexBlockDoc[];
  logs: Log[];
  onClose: () => void;
}) {
  const [days, setDays] = useState<number>(7);
  const [title, setTitle] = useState("Progress report");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const pastReports = useQuery(api.reports.list) ?? [];
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);

  const liveIds = useMemo(() => new Set(blocks.map((b) => b._id)), [blocks]);

  // Default the selection to report-flagged blocks (spec §9). Keeps syncing with
  // reactive block updates until the user first toggles a checkbox.
  useEffect(() => {
    if (touched.current) return;
    setSelected(new Set(blocks.filter((b) => b.includeInReports).map((b) => b._id)));
  }, [blocks]);

  // Logs constrained to the chosen period — the capture stage renders each block
  // against exactly what the report window covers.
  const periodLogs = useMemo(() => {
    const since = Date.now() - days * 86400000;
    return logs.filter((l) => new Date(l.timestamp).getTime() >= since);
  }, [logs, days]);

  const selectedBlocks = useMemo(
    () => blocks.filter((b) => selected.has(b._id)),
    [blocks, selected],
  );

  function toggle(id: string) {
    touched.current = true;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generate(ids: string[]) {
    const chosen = blocks.filter((b) => ids.includes(b._id));
    if (chosen.length === 0) {
      toast.error("Select at least one block");
      return;
    }
    setBusy(true);
    try {
      // Let recharts/layout settle in the offscreen stage before rasterizing.
      await new Promise((r) => setTimeout(r, 350));
      const { toPng } = await import("html-to-image");

      const images: { title: string; image: string }[] = [];
      for (const b of chosen) {
        const node = nodeRefs.current.get(b._id);
        if (!node) continue;
        const image = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: "#09090b",
          cacheBust: true,
        });
        images.push({ title: b.title, image });
      }
      if (images.length === 0) {
        toast.error("Nothing to capture");
        return;
      }

      const { buildReportPdf } = await import("@/utils/report-pdf");
      const blob = await buildReportPdf({
        title: title.trim() || "Progress report",
        subtitle: periodLabel(days),
        generatedAt: new Date().toLocaleString(),
        blocks: images,
      });

      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();

      await createReport({
        storageId,
        includedBlockIds: chosen.map((b) => b._id) as never[],
        range: days,
        title: title.trim() || "Progress report",
      });

      const slug = (title.trim() || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      download(blob, `${slug}-${days}d.pdf`);
      toast.success("Report generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setBusy(false);
    }
  }

  // Regenerate from a past report: re-capture only the block ids that still
  // resolve to live blocks; dangling ids are dropped (spec §9 / §11 Q4).
  function regenerate(r: { includedBlockIds?: string[]; blockCount: number; title: string | null }) {
    const ids = (r.includedBlockIds ?? []).filter((id) => liveIds.has(id));
    if (ids.length === 0) {
      toast.error("All of this report's blocks have been deleted");
      return;
    }
    const skipped = r.blockCount - ids.length;
    touched.current = true;
    setSelected(new Set(ids));
    if (r.title) setTitle(r.title);
    if (skipped > 0) toast(`Skipping ${skipped} deleted block${skipped === 1 ? "" : "s"}`);
    void generate(ids);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
        <DialogHeader className="space-y-0 border-b border-zinc-800/80 px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400">
              <FileText size={15} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-zinc-100">
                Export report
              </DialogTitle>
              <p className="mt-0.5 text-xs font-normal text-zinc-500">
                Pick the blocks to include, then generate a PDF
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Choose which canvas blocks to include and a period, then generate a PDF report.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-3 p-5">
            <div className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="space-y-2">
                <SectionLabel>Title</SectionLabel>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200 focus-visible:ring-zinc-700"
                  placeholder="Progress report"
                />
              </div>

              <div className="space-y-2">
                <SectionLabel>Period</SectionLabel>
                <ToggleGroup
                  type="single"
                  value={String(days)}
                  onValueChange={(v) => { if (v) setDays(Number(v)); }}
                  className="grid w-full grid-cols-3 gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1"
                >
                  {PERIODS.map((p) => (
                    <ToggleGroupItem
                      key={p.days}
                      value={String(p.days)}
                      className="h-7 rounded text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 data-[state=on]:bg-violet-500/15 data-[state=on]:text-violet-300"
                    >
                      {p.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <SectionLabel>Blocks</SectionLabel>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {selected.size} of {blocks.length} selected
                  </span>
                </div>
                {blocks.length === 0 ? (
                  <p className="text-xs leading-relaxed text-zinc-600">
                    No blocks yet — log something to seed your canvas first.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
                    {blocks.map((b) => {
                      const cat = getCat(b.queryConfig?.category ?? "");
                      return (
                        <label
                          key={b._id}
                          className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-zinc-800/60"
                        >
                          <Checkbox
                            checked={selected.has(b._id)}
                            onCheckedChange={() => toggle(b._id)}
                            className="border-zinc-700 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500"
                          />
                          <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + cat.dot} />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300">
                            {b.title}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] uppercase text-zinc-600">
                            {b.type}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={() => generate([...selected])}
                disabled={busy || selected.size === 0}
                variant="outline"
                className="w-full gap-2 border-violet-500/30 bg-violet-500/10 text-[13px] font-medium text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                    Rendering PDF…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Generate report
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex items-baseline justify-between">
                <SectionLabel>Past reports</SectionLabel>
                {pastReports.length > 0 ? (
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {pastReports.length} generated
                  </span>
                ) : null}
              </div>
              {pastReports.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  No reports yet — pick blocks above to export your first.
                </p>
              ) : (
                <div className="mt-1">
                  {pastReports.map((r, i) => {
                    const stale = r.liveBlocks < r.blockCount;
                    return (
                      <div
                        key={r._id}
                        className={
                          "group flex items-center gap-3 py-2.5 " +
                          (i < pastReports.length - 1 ? "border-b border-zinc-800/60" : "")
                        }
                      >
                        <a
                          href={r.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors group-hover:text-violet-400">
                            <FileText size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-zinc-300 transition-colors group-hover:text-zinc-100">
                              {r.title ?? "Report"}
                            </p>
                            <p className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
                              {periodLabel(r.range)} · {r.blockCount} block{r.blockCount === 1 ? "" : "s"}
                              {stale ? (
                                <span className="inline-flex items-center gap-1 text-amber-500/80">
                                  <AlertTriangle size={9} /> {r.liveBlocks} live
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[10.5px] text-zinc-600">
                            {formatTimeAgo(new Date(r.createdAt).toISOString())}
                          </span>
                        </a>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            title="Regenerate from current block state"
                            onClick={() => regenerate(r)}
                            disabled={busy}
                            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <a
                            href={r.url ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            title="Open PDF"
                            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            title="Delete report"
                            onClick={async () => {
                              try { await removeReport({ id: r._id as never }); }
                              catch { toast.error("Could not delete report"); }
                            }}
                            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Offscreen capture stage — renders each selected block exactly as it
            appears on-canvas so html-to-image can rasterize it (spec §9). */}
        <div
          aria-hidden
          style={{ position: "fixed", top: 0, left: -100000, zIndex: -1, pointerEvents: "none" }}
        >
          {selectedBlocks.map((b) => (
            <div
              key={b._id}
              ref={(el) => {
                if (el) nodeRefs.current.set(b._id, el);
                else nodeRefs.current.delete(b._id);
              }}
              style={{ width: CAPTURE_W, height: captureHeight(b), background: "#09090b" }}
            >
              <BlockBody block={b} logs={periodLogs} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
