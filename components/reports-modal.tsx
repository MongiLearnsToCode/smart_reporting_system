'use client';

import { useState } from "react";
import { FileText, Sparkles, ExternalLink, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  ToggleGroup, ToggleGroupItem,
  Button, Input, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { formatTimeAgo, BUSINESS_SCOPE_LABEL } from "@/lib/dashboard-utils";
import { useProjects } from "@/utils/convex/hooks";
import { scopeLabel } from "@/components/project-scope-picker";
import { resolveRegenerationScope } from "@/lib/report-scope";
import { csrfFetch } from "@/utils/api/csrf";
import { highlightStats } from "@/lib/report-tables";
import { financialVisual } from "@/lib/report-chart";
import type { Brief } from "@/lib/report-assemble";

const PERIODS = [
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 90, label: "Quarter" },
] as const;

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

export function ReportsModal({ onClose, projectId = null, onRequestScope }: {
  onClose: () => void;
  /** Scope the report covers — recorded on every report. */
  projectId?: string | null;
  /** Switches the app's view scope, so an out-of-scope report can be regenerated. */
  onRequestScope?: (projectId: string | null) => void;
}) {
  const [days, setDays] = useState<number>(7);
  const [title, setTitle] = useState("Progress report");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  // Last generated brief, kept so the prose stays on screen after export.
  const [preview, setPreview] = useState<Brief | null>(null);

  const pastReports = useQuery(api.reports.list) ?? [];
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);

  const { projects } = useProjects();
  const currentScope = scopeLabel(projectId, projects);

  async function generate() {
    setBusy(true);
    try {
      // The narrative is the report, built server-side from the scoped logs.
      setStage("Writing the brief…");
      const briefRes = await csrfFetch("/api/reports/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, projectId, title: title.trim() || "Progress report" }),
      });
      const briefData = await briefRes.json();
      if (!briefRes.ok) throw new Error(briefData.error || "Could not write the brief");
      const brief: Brief = briefData.brief;
      setPreview(brief);

      setStage("Rendering PDF…");
      const { buildReportPdf } = await import("@/utils/report-pdf");
      const blob = await buildReportPdf({
        title: brief.title,
        // The PDF leaves the app, so it has to say which scope it covers on its
        // own — a project report and a company-wide one look identical otherwise.
        scopeLabel: brief.scopeLabel,
        periodLabel: brief.periodLabel,
        // A date, not a timestamp — seconds are noise on a client document.
        generatedAt: new Date(brief.generatedAt).toLocaleDateString(undefined, {
          day: "numeric", month: "long", year: "numeric",
        }),
        sections: brief.sections.map((s) => ({ title: s.title, body: s.body, items: s.items })),
        stats: highlightStats(brief.facts, brief.comparison),
        // Chart or table, drawn natively — never a screenshot of the canvas.
        financials: financialVisual(brief.facts),
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
        // Reports no longer embed canvas blocks; a report is fully described by
        // its scope, period and title, which is what makes it reproducible.
        includedBlockIds: [] as never[],
        range: days,
        title: title.trim() || "Progress report",
        projectId: projectId as never,
      });

      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const scopeSlug = projectId ? `${slug(currentScope)}-` : "";
      download(blob, `${scopeSlug}${slug(title.trim() || "report")}-${days}d.pdf`);
      toast.success("Report generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  // Regenerate a past report: re-run the brief for its scope and period.
  function regenerate(r: {
    includedBlockIds?: string[];
    blockCount: number;
    title: string | null;
    projectId: string | null;
    projectName: string | null;
  }) {
    const decision = resolveRegenerationScope(r, projectId, !!onRequestScope);
    if (decision.action === "block") {
      toast.error(decision.reason);
      return;
    }
    if (decision.action === "switch") {
      onRequestScope!(decision.projectId);
      toast(`Switched to ${decision.scopeName}`, {
        description: "Press regenerate again to rebuild this report.",
      });
      return;
    }

    // A report is reproducible from scope, period and title alone now that
    // nothing is captured from the canvas.
    if (r.title) setTitle(r.title);
    void generate();
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
                Covers <span className="text-zinc-300">{currentScope}</span> — switch scope in the
                header to report on something else
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Choose a period, then generate a written PDF brief for the current scope.
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

              <Button
                onClick={() => generate()}
                disabled={busy}
                variant="outline"
                className="w-full gap-2 border-violet-500/30 bg-violet-500/10 text-[13px] font-medium text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                    {stage ?? "Working…"}
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Generate report
                  </>
                )}
              </Button>
            </div>

            {preview ? (
              <div className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
                <div className="flex items-baseline justify-between">
                  <SectionLabel>Brief</SectionLabel>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {preview.scopeLabel} · {preview.periodLabel}
                  </span>
                </div>
                {preview.sections.map((s) => (
                  <div key={s.id} className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                      {s.title}
                    </p>
                    <p className="text-[12.5px] leading-relaxed text-zinc-300">{s.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

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
                  No reports yet — generate your first above.
                </p>
              ) : (
                <div className="mt-1">
                  {pastReports.map((r, i) => {
                    // Flagged so it's obvious why regenerate switches scope first.
                    const otherScope = (r.projectId ?? null) !== projectId;
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
                              <span className={otherScope ? "text-violet-400/80" : undefined}>
                                {r.projectId ? r.projectName ?? "Deleted project" : BUSINESS_SCOPE_LABEL}
                              </span>
                              · {periodLabel(r.range)}
                              {r.blockCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-500/80">
                                  <AlertTriangle size={9} /> legacy block export
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
                            title={
                              otherScope
                                ? `Covers a different scope — switch to ${r.projectId ? r.projectName ?? "a deleted project" : BUSINESS_SCOPE_LABEL} to regenerate`
                                : "Regenerate from the current logs"
                            }
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

      </DialogContent>
    </Dialog>
  );
}
