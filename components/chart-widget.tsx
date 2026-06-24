'use client';

import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Maximize2 } from "lucide-react";

export function ChartWidget({ title, data, type, onClick }: {
  title: string;
  data?: Array<{ date: string; value: number }>;
  type?: string;
  onClick?: () => void;
}) {
  const chartType = type || "line";
  return (
    <motion.div
      layout
      onClick={onClick}
      className="group flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm transition-all hover:border-zinc-700 hover:shadow-xl cursor-pointer"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          {title}
        </h3>
        <Maximize2
          size={14}
          className="opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500"
        />
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }} itemStyle={{ color: "#fff" }} />
              <Line type="monotone" dataKey="value" stroke="#fff" strokeWidth={3} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }} itemStyle={{ color: "#fff" }} />
              <Bar dataKey="value" fill="#fff" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
