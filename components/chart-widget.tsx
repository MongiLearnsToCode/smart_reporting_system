'use client';

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  axisTicks, bucketSeries, chartForm, compactMoney, labelInterval, type Point,
} from "@/lib/block-chart";

// A money chart that can be read without hovering.
//
// Both axes used to be hidden, which left a coloured curve on a dotted field
// and a tooltip as the only route to a value — decoration with a data source.
// A chart on a dashboard someone exports and sends has to state its own scale.

export function ChartWidget({ title, points, currency, color, accentDot, onClick }: {
  title: string;
  /** Raw money events; bucketing into periods happens here, not upstream. */
  points: Point[];
  currency?: string | null;
  color?: string;
  accentDot?: string;
  onClick?: () => void;
}) {
  const stroke = color || "#a1a1aa";

  // The form depends on the space available, so the block measures itself.
  //
  // It measures the *panel*, not the plot area. Measuring the plot created a
  // feedback loop: the bar form has a units caption the small forms don't, so
  // the plot was 130px tall as bars and 111px as a sparkline — one side of the
  // threshold each. The chart flipped between the two forever. The panel's
  // size doesn't depend on what is drawn inside it.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const observer = useRef<ResizeObserver | null>(null);
  const panelRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    observer.current = ro;
  }, []);

  const { buckets, grain } = bucketSeries(points);
  const form = chartForm(buckets.length, size.w, size.h);
  const total = buckets.reduce((sum, b) => sum + b.value, 0);
  const peak = Math.max(0, ...buckets.map((b) => b.value));
  const ticks = axisTicks(peak);

  const axisTick = { fill: "#71717a", fontSize: 9 };
  const tooltipStyle = {
    backgroundColor: "#18181b", border: "1px solid #3f3f46",
    borderRadius: "8px", fontSize: "12px",
  };
  const period = grain === "day" ? "daily" : grain === "week" ? "weekly" : "monthly";

  return (
    <motion.div
      layout
      ref={panelRef}
      onClick={onClick}
      className={
        "group flex h-full flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition-all hover:border-zinc-700 " +
        (onClick ? "cursor-pointer" : "")
      }
    >
      <div className="mb-1 flex items-center gap-2">
        {accentDot ? <div className={"h-1.5 w-1.5 shrink-0 rounded-full " + accentDot} /> : null}
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h3>
      </div>
      {/* The axis prints bare numbers, so the units are stated once here. An
          axis reading "1.2k" with no currency is not a figure. Only for the
          bar form: at the smaller sizes the currency rides on the hero number
          instead, because a 128px block has no height to spend on a caption
          and still fit a plot. */}
      {form === "bars" ? (
        <p className="mb-3 text-[10px] text-zinc-600">
          {currency ? currency + " · " : ""}{period}
        </p>
      ) : (
        <div className="mb-2" />
      )}

      <div className="relative min-h-0 flex-1">
        {form === "empty" ? (
          <div className="flex h-full items-center justify-center text-[11px] text-zinc-700">
            No amounts logged yet
          </div>
        ) : form === "stat" ? (
          // One bucket is a number. A single bar carries no comparison, so
          // drawing one is ink spent saying what the figure already says.
          <Hero total={total} currency={currency} label={buckets[0]?.label} />
        ) : form === "sparkline" ? (
          <div className="flex h-full flex-col">
            <Hero total={total} currency={currency} compact />
            {/* Takes whatever height is left rather than claiming a fixed
                band — at the smallest block size a fixed one overflowed the
                panel and the sparkline was clipped out of existence. */}
            {/* Held back until the container has been measured: recharts
                warns on every render at width/height 0, which on a canvas of
                several charts floods the console. */}
            <div className="mt-2 min-h-0 w-full flex-1">
              {size.h > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={buckets} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  {/* Linear, not monotone: a spline through discrete
                      transactions draws values that never happened. */}
                  <Line type="linear" dataKey="value" stroke={stroke} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={80}>
            <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {/* Solid hairlines. Dashed gridlines read as a threshold or a
                  projection when they are only a grid. */}
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval={labelInterval(buckets.length, size.w)}
                minTickGap={4}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={38}
                ticks={ticks}
                domain={[0, ticks[ticks.length - 1]]}
                tickFormatter={compactMoney}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: "#e4e4e7" }}
                cursor={{ fill: "#ffffff08" }}
                formatter={(value) => [
                  `${currency ? currency + " " : ""}${Number(value).toLocaleString()}`,
                  "Total",
                ]}
              />
              <Bar dataKey="value" fill={stroke} radius={[3, 3, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

function Hero({ total, currency, label, compact }: {
  total: number;
  currency?: string | null;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "shrink-0" : "flex h-full flex-col justify-center"}>
      {/* Proportional figures: tabular-nums makes a large standalone number
          look loose, and nothing is aligning beneath it. */}
      <p className="text-2xl font-semibold leading-none text-zinc-100">
        {currency ? <span className="mr-1 text-sm text-zinc-500">{currency}</span> : null}
        {compactMoney(total)}
      </p>
      {label ? <p className="mt-1.5 text-[10px] text-zinc-600">{label}</p> : null}
    </div>
  );
}
