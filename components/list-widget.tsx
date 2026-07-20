'use client';

import { motion } from "framer-motion";

export function ListWidget({ title, items, accentDot, onClick }: {
  title: string;
  items?: { text: string; completed?: boolean; date?: string }[];
  accentDot?: string;
  onClick?: () => void;
}) {
  const rows = items || [];
  return (
    <motion.div
      layout
      onClick={onClick}
      className={
        "group flex h-full flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-5 py-4 transition-all hover:border-zinc-700 " +
        (onClick ? "cursor-pointer" : "")
      }
    >
      <div className="mb-3 flex items-center gap-2">
        {accentDot ? <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + accentDot} /> : null}
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map(function (item, i) {
          const dotColor = item.completed ? "bg-zinc-700" : "bg-zinc-400";
          const textColor = item.completed ? "text-zinc-500 line-through" : "text-zinc-300";
          return (
            <div key={i} className="flex items-center gap-3 border-b border-zinc-800/60 py-2 last:border-0">
              <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + dotColor} />
              <p className={"flex-1 truncate text-sm " + textColor}>{item.text}</p>
              {item.date ? (
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">{item.date}</span>
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="text-xs text-zinc-600">Nothing here yet.</p>
        ) : null}
      </div>
    </motion.div>
  );
}
