'use client';

import { useState, useEffect, use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  AlertTriangle,
  DollarSign,
  Calendar,
  TrendingUp,
  Zap,
  User,
  Tag,
  Package,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import useUser from "@/utils/useUser";
import Link from 'next/link';

const CATEGORY_COLORS: Record<string, any> = {
  Finance: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-500/30",
    chart: "#34d399",
  },
  Inventory: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-500/30",
    chart: "#fbbf24",
  },
  Projects: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-500/30",
    chart: "#60a5fa",
  },
  Clients: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    dot: "bg-purple-400",
    border: "border-purple-500/30",
    chart: "#a78bfa",
  },
  Tasks: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    dot: "bg-orange-400",
    border: "border-orange-500/30",
    chart: "#fb923c",
  },
  Team: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    dot: "bg-cyan-400",
    border: "border-cyan-500/30",
    chart: "#22d3ee",
  },
  Marketing: {
    bg: "bg-pink-500/10",
    text: "text-pink-400",
    dot: "bg-pink-400",
    border: "border-pink-500/30",
    chart: "#f472b6",
  },
};

function getCat(cat: string) {
  return (
    CATEGORY_COLORS[cat] || {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
      chart: "#a1a1aa",
    }
  );
}

function StatCard({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon size={13} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function LogDetailCard({ log }: any) {
  const entities = log.entities || {};
  const entityRows = [
    entities.amount != null && {
      label: "Amount",
      value: `${entities.currency || ""} ${entities.amount}`.trim(),
    },
    entities.date && {
      label: "Date",
      value: new Date(entities.date).toLocaleDateString(),
    },
    entities.sentiment && { label: "Sentiment", value: entities.sentiment },
    entities.urgency && { label: "Urgency", value: entities.urgency },
    entities.names?.length > 0 && {
      label: "People",
      value: entities.names.join(", "),
    },
    entities.tags?.length > 0 && {
      label: "Tags",
      value: entities.tags.join(", "),
    },
  ].filter(Boolean);

  const sentColor =
    entities.sentiment === "positive"
      ? "text-emerald-400"
      : entities.sentiment === "negative"
        ? "text-rose-400"
        : "text-zinc-500";
  const urgColor =
    entities.urgency === "high"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
      : entities.urgency === "medium"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
        : "bg-zinc-800 text-zinc-500 border-zinc-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-xl bg-zinc-800 flex items-center justify-center">
            {log.type === "file" ? (
              <FileText size={13} className="text-zinc-400" />
            ) : (
              <MessageSquare size={13} className="text-zinc-400" />
            )}
          </div>
          <span className="text-[11px] text-zinc-500">
            {new Date(log.timestamp).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {log.is_conflict ? (
            <span className="flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase tracking-widest">
              <AlertTriangle size={10} /> Conflict
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {entities.urgency && entities.urgency !== "low" ? (
            <span
              className={`text-[9px] font-black uppercase rounded-full px-2 py-0.5 border ${urgColor}`}
            >
              {entities.urgency}
            </span>
          ) : null}
          {entities.sentiment ? (
            <span className={`text-[10px] font-bold capitalize ${sentColor}`}>
              {entities.sentiment}
            </span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {log.raw_content}
        </p>
        {log.file_url ? (
          <a
            href={log.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <FileText size={11} /> View file
          </a>
        ) : null}
      </div>

      {/* Entity chips */}
      {entityRows.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {(entityRows as any).map(({ label, value }: any) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5"
            >
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                {label}:{" "}
              </span>
              <span className="text-[11px] font-semibold text-zinc-300 capitalize">
                {value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

export default function WidgetDetailPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: rawCategory } = use(params);
  const category = decodeURIComponent(rawCategory);
  const cat = getCat(category);
  const { data: user, loading: userLoading } = useUser();
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);

  useEffect(
    function () {
      if (!userLoading && !user) {
        window.location.href = "/account/signin";
      }
    },
    [user, userLoading],
  );

  const { data: logsData, isLoading } = useQuery({
    queryKey: ["logs-detail", category],
    enabled: !!user,
    queryFn: async function () {
      const res = await fetch("/api/logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const allLogs = (logsData && (logsData as any).logs) || [];
  const logs = allLogs.filter(function (l: any) {
    return l.category === category;
  });

  const filteredLogs = selectedSentiment
    ? logs.filter(function (l: any) {
        return l.entities && l.entities.sentiment === selectedSentiment;
      })
    : logs;

  // Stats
  const totalAmount = logs.reduce(function (sum: number, l: any) {
    return (
      sum +
      (l.entities && l.entities.amount != null ? Number(l.entities.amount) : 0)
    );
  }, 0);
  const hasAmounts = logs.some(function (l: any) {
    return l.entities && l.entities.amount != null;
  });
  const currency =
    logs.find(function (l: any) {
      return l.entities && l.entities.currency;
    })?.entities?.currency || "$";
  const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  logs.forEach(function (l: any) {
    const s = l.entities && l.entities.sentiment;
    if (s && sentiments[s] !== undefined) sentiments[s]++;
  });
  const dominantSentiment = Object.entries(sentiments).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const conflicts = logs.filter(function (l: any) {
    return l.is_conflict;
  }).length;

  // Chart data — group by day
  const chartMap: Record<string, any> = {};
  logs.forEach(function (l: any) {
    const day = new Date(l.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!chartMap[day]) chartMap[day] = { date: day, value: 0, count: 0 };
    chartMap[day].count++;
    if (l.entities && l.entities.amount != null)
      chartMap[day].value += Number(l.entities.amount);
  });
  const chartData = Object.values(chartMap).reverse();

  // All unique tags
  const allTags = Array.from(
    new Set(
      logs.flatMap(function (l: any) {
        return (l.entities && l.entities.tags) || [];
      }),
    ),
  ).slice(0, 12);

  // All unique people/orgs
  const allPeople = Array.from(
    new Set(
      logs.flatMap(function (l: any) {
        return (l.entities && l.entities.names) || [];
      }),
    ),
  ).slice(0, 10);

  if (userLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div
          className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-zinc-900 bg-black/90 backdrop-blur-xl px-6 h-14">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
        >
          <ArrowLeft size={14} /> Back to Canvas
        </Link>
        <div className="h-4 w-px bg-zinc-800" />
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${cat.dot}`} />
          <span
            className={`text-sm font-black uppercase tracking-widest ${cat.text}`}
          >
            {category}
          </span>
        </div>
        <span className="ml-auto text-[11px] text-zinc-600">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* HERO */}
        <div className={`rounded-3xl border ${cat.border} ${cat.bg} p-8`}>
          <p
            className={`text-[10px] font-black uppercase tracking-widest ${cat.text} mb-2`}
          >
            Category Overview
          </p>
          <h1 className="text-4xl font-black text-white mb-1">{category}</h1>
          <p className="text-zinc-400 text-sm">
            {logs.length === 0
              ? "No entries logged yet."
              : `${logs.length} log ${logs.length === 1 ? "entry" : "entries"} captured`}
            {conflicts > 0
              ? ` · ${conflicts} conflict${conflicts > 1 ? "s" : ""}`
              : ""}
          </p>
        </div>

        {/* STATS ROW */}
        {logs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Hash} label="Total Entries" value={logs.length} />
            {hasAmounts ? (
              <StatCard
                icon={DollarSign}
                label="Total Amount"
                value={`${currency} ${totalAmount.toLocaleString()}`}
              />
            ) : null}
            <StatCard
              icon={TrendingUp}
              label="Sentiment"
              value={
                dominantSentiment
                  ? dominantSentiment.charAt(0).toUpperCase() +
                    dominantSentiment.slice(1)
                  : "—"
              }
              sub={`${sentiments.positive}↑ ${sentiments.neutral}→ ${sentiments.negative}↓`}
            />
            <StatCard
              icon={Calendar}
              label="Latest"
              value={
                logs[0]
                  ? new Date(logs[0].timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
              }
              sub={
                logs[0]
                  ? new Date(logs[0].timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""
              }
            />
          </div>
        ) : null}

        {/* CHART */}
        {chartData.length > 1 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
              {hasAmounts ? "Amount Over Time" : "Activity Over Time"}
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                {hasAmounts ? (
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#27272a"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#52525b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#52525b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="value"
                      fill={cat.chart}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#27272a"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#52525b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#52525b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={cat.chart}
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* TAGS + PEOPLE */}
        {allTags.length > 0 || allPeople.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allTags.length > 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={13} className="text-zinc-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Keywords
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(function (tag) {
                    return (
                      <span
                        key={tag}
                        className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-300 capitalize"
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {allPeople.length > 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User size={13} className="text-zinc-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    People & Orgs
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allPeople.map(function (name) {
                    return (
                      <span
                        key={name}
                        className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-300"
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* LOG ENTRIES */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              All Entries {selectedSentiment ? `· ${selectedSentiment}` : ""}
            </p>
            {/* Sentiment filter */}
            <div className="flex items-center gap-1.5">
              {["positive", "neutral", "negative"].map(function (s) {
                const active = selectedSentiment === s;
                const colors =
                  s === "positive"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : s === "negative"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700";
                return (
                  <button
                    key={s}
                    onClick={function () {
                      setSelectedSentiment(active ? null : s);
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border transition-all ${active ? colors : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-zinc-600">
              <div
                className="h-6 w-6 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin"
              />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-700 rounded-2xl border-2 border-dashed border-zinc-900">
              <Package size={36} strokeWidth={1} className="mb-3" />
              <p className="text-sm font-medium">
                {selectedSentiment
                  ? `No ${selectedSentiment} entries`
                  : "No entries yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredLogs.map(function (log: any) {
                  return <LogDetailCard key={log.id} log={log} />;
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
