'use client';

import { motion } from "framer-motion";
import { Maximize2 } from "lucide-react";

export function ListWidget({ title, items, onClick }: {
  title: string;
  items?: { text: string; completed?: boolean; date?: string }[];
  onClick?: () => void;
}) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className="group flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900 px-6 py-4 shadow-sm transition-all hover:border-zinc-700 hover:shadow-xl cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">{title}</h3>
        <Maximize2 size={12} className="opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500" />
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {(items || []).map(function (item, i) {
          const dotColor = item.completed ? "bg-zinc-700" : "bg-blue-500";
          const textColor = item.completed ? "text-zinc-500 line-through" : "text-zinc-200";
          return (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
              <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + dotColor} />
              <p className={"flex-1 text-sm truncate " + textColor}>{item.text}</p>
              {item.date ? (
                <span className="shrink-0 text-[10px] text-zinc-600">{item.date}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
