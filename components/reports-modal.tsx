'use client';

import { useEffect, useRef, useState } from "react";
import { FileText, Sparkles, ExternalLink, Trash2, RotateCcw, AlertTriangle, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  ToggleGroup, ToggleGroupItem,
  Button, Input, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { formatTimeAgo, BUSINESS_SCOPE_LABEL } from "@/lib/dashboard-utils";
import { useProjects, useReportDraft } from "@/utils/convex/hooks";
import { scopeLabel } from "@/components/project-scope-picker";
import { resolveRegenerationScope } from "@/lib/report-scope";
import { csrfFetch } from "@/utils/api/csrf";
import { createClient } from "@/utils/supabase/client";
import { highlightStats } from "@/lib/report-tables";
import { financialVisual } from "@/lib/report-chart";
import type { Brief, BriefSection } from "@/lib/report-assemble";
import { isBriefFacts } from "@/lib/report-brief";

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
  // The editable copy. Separate from `preview` so "Reset" always has the
  // original to go back to, and so an edit never mutates the generated facts.
  const [draft, setDraft] = useState<BriefSection[]>([]);
  // What the generation produced, for Reset — held separately from `preview`
  // because a restored draft has no preview until it is regenerated.
  const [generated, setGenerated] = useState<BriefSection[]>([]);
  // Facts and deltas the stat strip and chart are rendered from. Carried on
  // the draft so a restored one exports without regenerating.
  const [factsFor, setFactsFor] = useState<{ facts: Brief["facts"]; comparison: Brief["comparison"] } | null>(null);
  const [companyName, setCompanyName] = useState("Your company");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata;
      const name = metadata?.company_name ?? metadata?.full_name;
      if (typeof name === "string" && name.trim()) setCompanyName(name.trim());
    });
  }, []);

  const { draft: saved, loading: draftLoading, save: saveDraft, discard: discardDraft } =
    useReportDraft(projectId ?? null, days);

  // Restoring: only when the editor is empty for this scope and period. An
  // autosave round-trip must never overwrite what is being typed.
  const restoredKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${projectId ?? "business"}:${days}`;
    if (draftLoading) return;
    if (restoredKey.current === key) return;
    restoredKey.current = key;
    if (saved) {
      setDraft(saved.sections as BriefSection[]);
      setGenerated((saved.generated ?? saved.sections) as BriefSection[]);
      // A draft outlives the code that wrote it. Facts in a shape this build
      // doesn't recognise cost the stat strip and the chart; the prose the
      // user wrote is the part worth keeping and it still exports.
      setFactsFor(
        isBriefFacts(saved.facts)
          ? { facts: saved.facts, comparison: saved.comparison ?? null }
          : null,
      );
      if (saved.title) setTitle(saved.title);
    } else {
      setDraft([]);
      setGenerated([]);
      setFactsFor(null);
    }
  }, [saved, draftLoading, projectId, days]);

  // Debounced autosave. Nothing about editing should require an explicit save;
  // the failure this exists to prevent is losing work by closing a dialog.
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current || draft.length === 0) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      void saveDraft({
        projectId: (projectId ?? null) as never,
        range: days,
        title: title.trim() || "Progress report",
        sections: draft.map(stripSection),
        // Carried through untouched when unusable, so a later build that
        // understands the shape again can still render from it.
        facts: factsFor ? factsFor.facts : saved?.facts,
        comparison: factsFor?.comparison ?? undefined,
      }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, title, factsFor, saved, projectId, days, saveDraft]);

  function editDraft(next: BriefSection[]) {
    dirty.current = true;
    setDraft(next);
  }

  const edited =
    draft.length !== generated.length ||
    draft.some((s, i) => s.body !== generated[i]?.body || s.title !== generated[i]?.title);

  function editSection(i: number, patch: Partial<BriefSection>) {
    editDraft(draft.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function removeSection(i: number) {
    editDraft(draft.filter((_, j) => j !== i));
  }
  function moveSection(i: number, by: -1 | 1) {
    const to = i + by;
    if (to < 0 || to >= draft.length) return;
    const next = [...draft];
    [next[i], next[to]] = [next[to], next[i]];
    editDraft(next);
  }
  function addSection() {
    editDraft([
      ...draft,
      // A section of the user's own is what makes them the author rather than
      // the data source — recommendations, context, anything the logs can't know.
      { id: `custom-${Date.now()}` as BriefSection["id"], title: "Your note", body: "", source: "facts" },
    ]);
  }

  /** Drops fields the draft table doesn't carry, so the validator stays strict. */
  function stripSection(s: BriefSection) {
    return { id: String(s.id), title: s.title, body: s.body, items: s.items, source: s.source };
  }

  const pastReports = useQuery(api.reports.list) ?? [];
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);

  const { projects } = useProjects();
  const currentScope = scopeLabel(projectId, projects);

  // Draft and export are separate steps on purpose. A generated report is a
  // first draft — the facts are the app's, the judgement is the user's — and
  // there was previously no moment between the two in which to add any.
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
      const fresh = brief.sections.map((s) => ({ ...s }));
      setPreview(brief);
      setDraft(fresh);
      setGenerated(fresh);
      setFactsFor({ facts: brief.facts, comparison: brief.comparison });
      // Written immediately, not on the next edit: a draft that only persists
      // once you touch it still loses the generation itself.
      dirty.current = false;
      await saveDraft({
        projectId: (projectId ?? null) as never,
        range: days,
        title: title.trim() || "Progress report",
        sections: fresh.map(stripSection),
        generated: fresh.map(stripSection),
        facts: brief.facts,
        comparison: brief.comparison ?? undefined,
      }).catch(() => undefined);
      toast.success("Draft saved — edit it, or download as it stands");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write the brief");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  async function exportPdf() {
    if (draft.length === 0) return;
    setBusy(true);
    try {
      setStage("Rendering PDF…");
      const { buildReportPdf } = await import("@/utils/report-pdf");
      const blob = await buildReportPdf({
        title: title.trim() || "Progress report",
        companyName,
        // The PDF leaves the app, so it has to say which scope it covers on its
        // own — a project report and a company-wide one look identical otherwise.
        scopeLabel: currentScope,
        periodLabel: PERIODS.find((p) => p.days === days)?.label ?? `Last ${days} days`,
        // A date, not a timestamp — seconds are noise on a client document.
        generatedAt: new Date().toLocaleDateString(undefined, {
          day: "numeric", month: "long", year: "numeric",
        }),
        // The edited draft, not what came back from the server.
        sections: draft
          .filter((s) => s.body.trim() || s.items?.length)
          .map((s) => ({ title: s.title, body: s.body, items: s.items })),
        // Omitted rather than guessed when the stored facts are unusable.
        stats: factsFor ? highlightStats(factsFor.facts, factsFor.comparison) : undefined,
        // Chart or table, drawn natively — never a screenshot of the canvas.
        financials: factsFor ? financialVisual(factsFor.facts) : undefined,
        unconvertedTransactions: factsFor?.facts.unconvertedTransactions,
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
      toast.success("Report downloaded");
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
                onClick={() => {
                  if (
                    edited &&
                    !window.confirm(
                      "Regenerating replaces your edits with a fresh draft. Continue?",
                    )
                  ) return;
                  void generate();
                }}
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
                    {/* Keys off the draft, not `preview`: a draft restored from a
                        previous session has no preview, and the button read
                        "Generate draft" over work already in progress. */}
                    <Sparkles size={13} /> {draft.length > 0 ? "Regenerate draft" : "Generate draft"}
                  </>
                )}
              </Button>
            </div>

            {draft.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
                <div className="flex items-baseline justify-between">
                  <SectionLabel>Draft</SectionLabel>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {currentScope} · {PERIODS.find((p) => p.days === days)?.label ?? `${days}d`}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-600">
                  Edit anything below before you download. Changes save as you type —
                  closing this dialog keeps them.
                </p>
                {!factsFor ? (
                  <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-300/80">
                    The figures saved with this draft can&apos;t be read by this version, so
                    the summary strip and chart are left out. Your text is intact —
                    regenerate to bring the figures back.
                  </p>
                ) : null}

                {draft.map((s, i) => (
                  <div
                    key={s.id}
                    className="group/section space-y-1.5 rounded-lg border border-transparent p-2 transition-colors hover:border-zinc-800 hover:bg-zinc-900/40"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        value={s.title}
                        onChange={(e) => editSection(i, { title: e.target.value })}
                        aria-label={`Section ${i + 1} heading`}
                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 outline-none transition-colors hover:border-zinc-800 focus:border-zinc-700 focus:bg-zinc-950"
                      />
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
                        <MiniBtn label="Move up" onClick={() => moveSection(i, -1)} disabled={i === 0}>
                          <ChevronUp size={11} />
                        </MiniBtn>
                        <MiniBtn label="Move down" onClick={() => moveSection(i, 1)} disabled={i === draft.length - 1}>
                          <ChevronDown size={11} />
                        </MiniBtn>
                        <MiniBtn label="Remove section" danger onClick={() => removeSection(i)}>
                          <Trash2 size={11} />
                        </MiniBtn>
                      </div>
                    </div>
                    <textarea
                      value={s.body}
                      onChange={(e) => editSection(i, { body: e.target.value })}
                      aria-label={`${s.title} text`}
                      rows={Math.max(2, Math.ceil(s.body.length / 78))}
                      placeholder="Write this section…"
                      className="w-full resize-y rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] leading-relaxed text-zinc-300 outline-none transition-colors hover:border-zinc-800 focus:border-zinc-700 focus:bg-zinc-950"
                    />
                    {s.items?.length ? (
                      <ul className="space-y-0.5 pl-1">
                        {s.items.map((item, j) => (
                          <li key={j} className="flex gap-1.5 text-[12px] text-zinc-400">
                            <span className="text-zinc-600">—</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
                  <button
                    type="button"
                    onClick={addSection}
                    className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
                  >
                    <Plus size={11} /> Add a section
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editDraft(generated.map((x) => ({ ...x })))}
                      disabled={!edited}
                      className="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-30"
                    >
                      Reset
                    </button>
                    <Button onClick={exportPdf} disabled={busy || draft.length === 0}>
                      {busy ? stage ?? "Working…" : "Download PDF"}
                    </Button>
                  </div>
                </div>
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

/** Small icon control for the draft editor's per-section actions. */
function MiniBtn({ children, onClick, label, disabled, danger }: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        "rounded p-1 transition-colors disabled:opacity-25 " +
        (danger
          ? "text-zinc-600 hover:bg-red-600 hover:text-white"
          : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-200")
      }
    >
      {children}
    </button>
  );
}
