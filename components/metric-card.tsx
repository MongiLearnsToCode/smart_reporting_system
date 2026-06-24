'use client';

import { motion } from "framer-motion";
import { TrendingUp, Maximize2 } from "lucide-react";

export function MetricCard({ title, value, unit, sentiment, onClick }: {
  title: string;
  value?: number | string | null;
  unit?: string;
  sentiment?: string;
  onClick?: () => void;
}) {
  const sentColor =
    sentiment === "positive"
      ? "text-emerald-400"
      : sentiment === "negative"
        ? "text-rose-400"
        : "text-zinc-500";
  return (
    <motion.div
      layout
      onClick={onClick}
      className="group relative flex items-center justify-between rounded-3xl border border-zinc-800 bg-zinc-900 px-6 py-4 shadow-sm transition-all hover:border-zinc-700 hover:shadow-xl cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-400">{title}</span>
        {sentiment ? (
          <span className={"flex items-center gap-1 text-[10px] font-bold " + sentColor}>
            {sentiment === "positive" ? <TrendingUp size={10} /> : null}
            {sentiment.toUpperCase()}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black tracking-tight text-white">
          {value == null ? "—" : value}
        </span>
        {unit ? (
          <span className="text-xs font-medium text-zinc-500">{unit}</span>
        ) : null}
        <Maximize2
          size={12}
          className="ml-2 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500"
        />
      </div>
    </motion.div>
  );
}
