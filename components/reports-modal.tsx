'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, FileText, Sparkles, Copy, Check, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
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

function prettyName(name: string) {
  // "{ts}-{client-slug}-{days}d.html" → "client slug · Nd"
  const m = name.match(/^\d+-(.+)-(\d+)d\.html$/);
  if (!m) return name;
  return m[1].replace(/[_-]+/g, " ") + " · " + m[2] + " days";
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
      >
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileText size={16} className="text-zinc-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Client Reports</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Client</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={function () { setClient(null); }}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-all " +
                  (client === null
                    ? "border-white bg-white text-black"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600")
                }
              >
                All clients
              </button>
              {clients.map(function (c) {
                const active = client === c;
                return (
                  <button
                    key={c}
                    onClick={function () { setClient(active ? null : c); }}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition-all " +
                      (active
                        ? "border-white bg-white text-black"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-600")
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {clients.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-600">
                No clients detected yet — mention who work is for in your logs and Codex will pick them up.
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Period</p>
            <div className="flex gap-1.5">
              {PERIODS.map(function (p) {
                const active = days === p.days;
                return (
                  <button
                    key={p.days}
                    onClick={function () { setDays(p.days); }}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition-all " +
                      (active
                        ? "border-white bg-white text-black"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-600")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-black text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                Writing report…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate report
              </>
            )}
          </button>

          {result && result.url ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <p className="text-xs font-bold text-emerald-400">
                Report ready — link valid for 7 days
              </p>
              <div className="flex gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
                >
                  <ExternalLink size={12} /> Open
                </a>
                <button
                  onClick={function () { if (result.url) handleCopy(result.url); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">Past reports</p>
            {loadingList ? (
              <p className="text-xs text-zinc-600">Loading…</p>
            ) : pastReports.length === 0 ? (
              <p className="text-xs text-zinc-600">No reports yet. Generate your first one above.</p>
            ) : (
              <div className="space-y-1.5">
                {pastReports.map(function (r) {
                  return (
                    <a
                      key={r.path}
                      href={r.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900/50 px-3.5 py-2.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-white transition-all"
                    >
                      <span className="truncate font-medium capitalize">{prettyName(r.name)}</span>
                      <span className="ml-3 flex shrink-0 items-center gap-1 text-[10px] text-zinc-600">
                        <Clock size={10} />
                        {r.created_at ? formatTimeAgo(r.created_at) : ""}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
