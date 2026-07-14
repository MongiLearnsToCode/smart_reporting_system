'use client';

import { motion } from "framer-motion";
import { FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { getCat } from "@/lib/categories";
import { formatTimeAgo, logAmount, logClients, logSentiment, logUrgency, type Log } from "@/lib/dashboard-utils";

export function LogFeedItem({ log, onClick }: {
  log: Log;
  onClick: () => void;
}) {
  const cat = getCat(log.category);
  const preview =
    log.raw_content && log.raw_content.length > 80
      ? log.raw_content.slice(0, 80) + "…"
      : log.raw_content;
  const timeAgo = formatTimeAgo(log.timestamp);
  const sentiment = logSentiment(log);
  const urgency = logUrgency(log);
  const amount = logAmount(log);
  const client = logClients(log)[0];
  const sentBg =
    sentiment === "positive"
      ? "bg-emerald-500/10 text-emerald-400"
      : sentiment === "negative"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-zinc-800 text-zinc-500";
  const urgBg =
    urgency === "high"
      ? "bg-rose-500/10 text-rose-400"
      : "bg-amber-500/10 text-amber-400";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="group w-full text-left rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={"h-1.5 w-1.5 rounded-full " + cat.dot} />
          <span className={"text-[11px] font-medium " + cat.text}>
            {log.category}
          </span>
          {client ? (
            <span className="max-w-[90px] truncate rounded-full border border-zinc-800 px-1.5 py-px text-[10px] font-medium capitalize text-zinc-500">
              {client}
            </span>
          ) : null}
          {log.type === "file" ? (
            <FileText size={10} className="text-zinc-600" />
          ) : null}
          {log.is_conflict ? (
            <AlertTriangle size={10} className="text-amber-400" />
          ) : null}
        </div>
        <span className="font-mono text-[10px] text-zinc-600">{timeAgo}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
        {preview}
      </p>
      {amount ? (
        <p className="mt-2 font-mono text-[13px] font-medium text-zinc-100">
          {(amount.currency || "$") + " "}
          {amount.amount.toLocaleString()}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {sentiment ? (
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " + sentBg}>
              {sentiment}
            </span>
          ) : null}
          {urgency && urgency !== "low" ? (
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " + urgBg}>
              {urgency}
            </span>
          ) : null}
        </div>
        <ChevronRight
          size={12}
          className="text-zinc-700 group-hover:text-zinc-500 transition-colors"
        />
      </div>
    </motion.button>
  );
}
