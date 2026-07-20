'use client';

import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export function ChartWidget({ title, data, type, color, accentDot, onClick }: {
  title: string;
  data?: Array<{ date: string; value: number }>;
  type?: string;
  color?: string;
  accentDot?: string;
  onClick?: () => void;
}) {
  const chartType = type || "line";
  const stroke = color || "#a1a1aa";
  const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px" };
  return (
    <motion.div
      layout
      onClick={onClick}
      className={
        "group flex h-full flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition-all hover:border-zinc-700 " +
        (onClick ? "cursor-pointer" : "")
      }
    >
      <div className="mb-3 flex items-center gap-2">
        {accentDot ? <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + accentDot} /> : null}
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h3>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={80}>
          {chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e4e4e7" }} cursor={{ stroke: "#3f3f46" }} />
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e4e4e7" }} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="value" fill={stroke} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
