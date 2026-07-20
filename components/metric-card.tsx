'use client';

import { motion } from "framer-motion";

export function MetricCard({ title, value, unit, sentiment, accentDot, onClick }: {
  title: string;
  value?: number | string | null;
  unit?: string;
  sentiment?: string;
  accentDot?: string;
  onClick?: () => void;
}) {
  const sentBg =
    sentiment === "positive"
      ? "bg-emerald-500/10 text-emerald-400"
      : sentiment === "negative"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-zinc-800 text-zinc-500";
  return (
    <motion.div
      layout
      onClick={onClick}
      className={
        "group flex h-full flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-5 py-4 transition-all hover:border-zinc-700 " +
        (onClick ? "cursor-pointer" : "")
      }
    >
      <div className="flex items-center gap-2">
        {accentDot ? <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + accentDot} /> : null}
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </span>
        {sentiment ? (
          <span className={"ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " + sentBg}>
            {sentiment}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold tracking-tight tabular-nums text-zinc-50">
          {value == null ? "—" : value}
        </span>
        {unit ? (
          <span className="font-mono text-[11px] text-zinc-500">{unit}</span>
        ) : null}
      </div>
    </motion.div>
  );
}
