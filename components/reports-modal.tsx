'use client';

import { useEffect, useState } from "react";
import { FileText, Sparkles, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  ToggleGroup, ToggleGroupItem,
  Button, Badge, Skeleton, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { csrfFetch } from "@/utils/api/csrf";
import { formatTimeAgo } from "@/lib/dashboard-utils";

type ReportMeta = {
  name: string;
  path: string;
  url: string | null;
  created_at: string | null;
  client?: string | null;
  days?: number;
};

const PERIODS = [
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 90, label: "Quarter" },
] as const;

const ALL_CLIENTS = "__all__";

function prettyName(name: string) {
  // "{ts}-{client-slug}-{days}d.html" → "client slug · Nd"
  const m = name.match(/^\d+-(.+)-(\d+)d\.html$/);
  if (!m) return name;
  return m[1].replace(/[_-]+/g, " ") + " · " + m[2] + " days";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </p>
  );
}

export function ReportsModal({ clients, onClose }: {
  clients: string[];
  onClose: () => void;
}) {
  const [client, setClient] = useState<string | null>(null);
  const [days, setDays] = useState<number>(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ReportMeta | null>(null);
  const [copied, setCopied] = useState(false);
  const [pastReports, setPastReports] = useState<ReportMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(function () {
    let cancelled = false;
    fetch("/api/reports")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!cancelled) setPastReports(data.reports || []);
      })
      .catch(function () { /* list is non-critical */ })
      .finally(function () { if (!cancelled) setLoadingList(false); });
    return function () { cancelled = true; };
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await csrfFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report generation failed");
      setResult(data.report);
      setPastReports(function (prev) { return [data.report, ...prev]; });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Dialog open onOpenChange={function (open) { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
        <DialogHeader className="space-y-0 border-b border-zinc-800/80 px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400">
              <FileText size={15} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-zinc-100">
                Client reports
              </DialogTitle>
              <p className="mt-0.5 text-xs font-normal text-zinc-500">
                Turn your logs into a client-ready report
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Pick a client and period, generate a report from your logs, and share past reports.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-3 p-5">
            <div className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="space-y-2">
                <SectionLabel>Client</SectionLabel>
                <Select
                  value={client ?? ALL_CLIENTS}
                  onValueChange={function (v) { setClient(v === ALL_CLIENTS ? null : v); }}
                >
                  <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200 focus:ring-zinc-700">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
                    <SelectItem value={ALL_CLIENTS} className="text-[13px]">All clients</SelectItem>
                    {clients.map(function (c) {
                      return (
                        <SelectItem key={c} value={c} className="text-[13px] capitalize">
                          {c}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {clients.length === 0 ? (
                  <p className="text-xs leading-relaxed text-zinc-600">
                    No clients detected yet — mention who the work is for in your logs and Codex will pick them up.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <SectionLabel>Period</SectionLabel>
                <ToggleGroup
                  type="single"
                  value={String(days)}
                  onValueChange={function (v) { if (v) setDays(Number(v)); }}
                  className="grid w-full grid-cols-3 gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1"
                >
                  {PERIODS.map(function (p) {
                    return (
                      <ToggleGroupItem
                        key={p.days}
                        value={String(p.days)}
                        className="h-7 rounded text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 data-[state=on]:bg-violet-500/15 data-[state=on]:text-violet-300"
                      >
                        {p.label}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                variant="outline"
                className="w-full gap-2 border-violet-500/30 bg-violet-500/10 text-[13px] font-medium text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
              >
                {isGenerating ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                    Writing report…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Generate report
                  </>
                )}
              </Button>
            </div>

            {result && result.url ? (
              <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Report ready
                  </Badge>
                  <span className="font-mono text-[10.5px] text-zinc-500">link valid 7 days</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <a href={result.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Open
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={function () { if (result.url) handleCopy(result.url); }}
                    className="flex-1 gap-1.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex items-baseline justify-between">
                <SectionLabel>Past reports</SectionLabel>
                {!loadingList && pastReports.length > 0 ? (
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {pastReports.length} generated
                  </span>
                ) : null}
              </div>
              {loadingList ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-9 w-full bg-zinc-800/60" />
                  <Skeleton className="h-9 w-full bg-zinc-800/60" />
                  <Skeleton className="h-9 w-full bg-zinc-800/60" />
                </div>
              ) : pastReports.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  No reports yet — pick a client and period above to write your first.
                </p>
              ) : (
                <div className="mt-1">
                  {pastReports.map(function (r, i) {
                    return (
                      <a
                        key={r.path}
                        href={r.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={
                          "group flex items-center gap-3 py-2.5 " +
                          (i < pastReports.length - 1 ? "border-b border-zinc-800/60" : "")
                        }
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors group-hover:text-violet-400">
                          <FileText size={13} />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium capitalize text-zinc-300 transition-colors group-hover:text-zinc-100">
                          {prettyName(r.name)}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-zinc-600">
                          {r.created_at ? formatTimeAgo(r.created_at) : ""}
                        </span>
                        <ExternalLink
                          size={12}
                          className="shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-400"
                        />
                      </a>
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
