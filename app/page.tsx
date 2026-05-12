'use client';

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Mic,
  FileUp,
  History,
  Download,
  AlertCircle,
  TrendingUp,
  Users,
  Package,
  MessageSquare,
  Clock,
  Maximize2,
  X,
  AlertTriangle,
  RotateCcw,
  FileText,
  DollarSign,
  Tag,
  Calendar,
  User,
  Zap,
  ChevronRight,
  ScrollText,
  Pin,
  PinOff,
  LogOut,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import useUpload from "@/utils/useUpload";
import useUser from "@/utils/useUser";

const CATEGORY_COLORS: Record<string, any> = {
  Finance: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-500/30",
  },
  Inventory: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-500/30",
  },
  Projects: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-500/30",
  },
  Clients: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    dot: "bg-purple-400",
    border: "border-purple-500/30",
  },
  Tasks: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    dot: "bg-orange-400",
    border: "border-orange-500/30",
  },
  Team: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    dot: "bg-cyan-400",
    border: "border-cyan-500/30",
  },
  Marketing: {
    bg: "bg-pink-500/15",
    text: "text-pink-400",
    dot: "bg-pink-400",
    border: "border-pink-500/30",
  },
};

function getCat(cat: string) {
  return (
    CATEGORY_COLORS[cat] || {
      bg: "bg-zinc-500/15",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
    }
  );
}

function formatTimeAgo(timestamp: string | number | Date) {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function MetricCard(props: any) {
  const { title, value, unit, sentiment, onClick } = props;
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

function ChartWidget(props: any) {
  const { title, data, type, onClick } = props;
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
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis dataKey="date" hide />
              <YAxis hide />
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
                dataKey="value"
                stroke="#fff"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "12px",
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Bar dataKey="value" fill="#fff" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function ListWidget(props: any) {
  const { title, items, onClick } = props;
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
        {items.map(function (item: any, i: number) {
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

function FilePreviewModal({ file, fileUrl, fileName, onClose }: {
  file?: File;
  fileUrl?: string;
  fileName?: string;
  onClose: () => void;
}) {
  const blobUrl = useRef(file ? URL.createObjectURL(file) : null);
  useEffect(() => () => { if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); }, []);

  const url = blobUrl.current ?? fileUrl ?? "";
  const name = file?.name ?? fileName ?? "";
  const ext = name.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "");
  const isText = ["txt", "csv", "md"].includes(ext || "");
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (isText && file) file.text().then(setTextContent);
    else if (isText && url) fetch(url).then(r => r.text()).then(setTextContent);
  }, [file, isText, url]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm font-bold text-white truncate">{name}</span>
            {file ? <span className="text-xs text-zinc-600 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              download={name}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              <Download size={12} /> Download
            </a>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
          {isPdf && (
            <iframe src={url} className="w-full h-full min-h-[70vh]" title={name} />
          )}
          {isImage && (
            <div className="flex items-center justify-center p-4 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
            </div>
          )}
          {isText && (
            <pre className="p-5 text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
              {textContent ?? "Loading..."}
            </pre>
          )}
          {!isPdf && !isImage && !isText && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-500">
              <FileText size={48} strokeWidth={1} />
              <p className="text-sm font-medium">Preview not available for .{ext} files</p>
              <a
                href={url}
                download={name}
                className="flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-700 transition-colors"
              >
                <Download size={14} /> Download to open
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LogPreviewModal(props: any) {
  const { log, onClose, allLogs } = props;
  const [showAttachment, setShowAttachment] = useState(false);
  if (!log) return null;
  const cat = getCat(log.category);
  const entities = log.entities || {};
  const items = [];
  if (entities.amount != null)
    items.push({
      icon: DollarSign,
      label: "Amount",
      value: ((entities.currency || "") + " " + entities.amount).trim(),
    });
  if (entities.date)
    items.push({
      icon: Calendar,
      label: "Date",
      value: new Date(entities.date).toLocaleDateString(),
    });
  if (entities.sentiment)
    items.push({
      icon: TrendingUp,
      label: "Sentiment",
      value: entities.sentiment,
    });
  if (entities.urgency)
    items.push({ icon: Zap, label: "Urgency", value: entities.urgency });
  if (entities.names && entities.names.length > 0)
    items.push({
      icon: User,
      label: "People",
      value: entities.names.join(", "),
    });
  if (entities.tags && entities.tags.length > 0)
    items.push({ icon: Tag, label: "Tags", value: entities.tags.join(", ") });

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        className="w-full max-w-xl rounded-[36px] border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={function (e) {
          e.stopPropagation();
        }}
      >
        <div className="px-8 pt-8 pb-6 border-b border-zinc-800/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={
                  "h-9 w-9 rounded-2xl flex items-center justify-center " +
                  cat.bg
                }
              >
                {log.type === "file" ? (
                  <FileText size={16} className={cat.text} />
                ) : (
                  <MessageSquare size={16} className={cat.text} />
                )}
              </div>
              <div>
                <span
                  className={
                    "text-[10px] font-black uppercase tracking-widest " +
                    cat.text
                  }
                >
                  {log.category}
                </span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {log.is_conflict ? (
                <div className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  <AlertTriangle size={10} /> Conflict
                </div>
              ) : null}
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="px-8 py-6 border-b border-zinc-800/60">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">
            Raw Log
          </p>
          <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
            {log.raw_content}
          </p>
          {log.file_url ? (
            <button
              onClick={function () { setShowAttachment(true); }}
              className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <FileText size={12} /> View attached file
            </button>
          ) : null}
        </div>
        {log.is_conflict ? (
          <div className="px-8 py-5 border-b border-zinc-800/60 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Why this is flagged
              </p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {log.conflict_reason || (
                <>Another <span className="font-bold text-zinc-300">{log.category}</span> entry was already logged earlier today. This entry may duplicate or contradict it.</>
              )}
            </p>
            {log.conflict_source_id && allLogs ? (
              (() => {
                const src = allLogs.find((l: any) => l.id === log.conflict_source_id);
                return src ? (
                  <div className="mt-3 rounded-2xl border border-amber-500/20 bg-zinc-900 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Conflicting entry</p>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{src.raw_content}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">{new Date(src.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                ) : null;
              })()
            ) : null}
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="px-8 py-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4">
              Extracted Data
            </p>
            <div className="grid grid-cols-2 gap-3">
              {items.map(function (item) {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} className="text-zinc-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-200 capitalize truncate">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
    <AnimatePresence>
      {showAttachment && log.file_url ? (
        <FilePreviewModal
          fileUrl={log.file_url}
          fileName={log.raw_content.match(/^(?:File|Uploaded file): ([^\n(]+)/)?.[1]?.trim() ?? "attachment"}
          onClose={() => setShowAttachment(false)}
        />
      ) : null}
    </AnimatePresence>
    </>
  );
}

function LogFeedItem(props: any) {
  const { log, onClick, allLogs } = props;
  const cat = getCat(log.category);
  const preview =
    log.raw_content && log.raw_content.length > 80
      ? log.raw_content.slice(0, 80) + "…"
      : log.raw_content;
  const timeAgo = formatTimeAgo(log.timestamp);
  const sentBg =
    log.entities && log.entities.sentiment === "positive"
      ? "bg-emerald-500/10 text-emerald-400"
      : log.entities && log.entities.sentiment === "negative"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-zinc-800 text-zinc-500";
  const urgBg =
    log.entities && log.entities.urgency === "high"
      ? "bg-rose-500/10 text-rose-400"
      : "bg-amber-500/10 text-amber-400";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={"h-1.5 w-1.5 rounded-full " + cat.dot} />
          <span
            className={
              "text-[10px] font-black uppercase tracking-widest " + cat.text
            }
          >
            {log.category}
          </span>
          {log.type === "file" ? (
            <FileText size={10} className="text-zinc-600" />
          ) : null}
          {log.is_conflict ? (
            <AlertTriangle size={10} className="text-amber-400" />
          ) : null}
        </div>
        <span className="text-[10px] text-zinc-600">{timeAgo}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
        {preview}
      </p>
      {log.entities && log.entities.amount != null ? (
        <p className="mt-2 text-sm font-bold text-white">
          {(log.entities.currency || "$") + " "}
          {Number(log.entities.amount).toLocaleString()}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {log.entities && log.entities.sentiment ? (
            <span
              className={
                "text-[9px] font-bold uppercase rounded-full px-2 py-0.5 " +
                sentBg
              }
            >
              {log.entities.sentiment}
            </span>
          ) : null}
          {log.entities &&
          log.entities.urgency &&
          log.entities.urgency !== "low" ? (
            <span
              className={
                "text-[9px] font-bold uppercase rounded-full px-2 py-0.5 " +
                urgBg
              }
            >
              {log.entities.urgency}
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

export default function CodexApp() {
  const queryClient = useQueryClient();
  const userResult = useUser();
  const user = userResult.data as import("@supabase/supabase-js").User | null;
  const userLoading = userResult.loading;
  const uploadHook = useUpload();
  const upload = uploadHook[0] as (input: { file: File }) => Promise<{ url: string; mimeType: string | null } | { error: string }>;

  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeValue, setTimeValue] = useState(100);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<any>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const [isLogFeedPinned, setIsLogFeedPinned] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [widgetSort, setWidgetSort] = useState<"title" | "created" | "recent">("title");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(function () {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, []);

  useEffect(
    function () {
      if (!userLoading && !user) {
        window.location.href = "/account/signin";
      }
    },
    [user, userLoading],
  );

  const logsQuery = useQuery({
    queryKey: ["logs", timeValue],
    enabled: !!user,
    queryFn: async function () {
      const targetDate =
        timeValue < 100
          ? new Date(Date.now() - (100 - timeValue) * 86400000).toISOString()
          : null;
      const url = targetDate
        ? "/api/logs?before=" + encodeURIComponent(targetDate)
        : "/api/logs";
      const res = await fetch(url);
      return res.json();
    },
  });

  const widgetsQuery = useQuery({
    queryKey: ["widgets"],
    enabled: !!user,
    queryFn: async function () {
      const res = await fetch("/api/widgets");
      return res.json();
    },
  });

  const processMutation = useMutation({
    mutationFn: async function (payload: any) {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }
      return res.json();
    },
    onSuccess: function () {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setInputText("");
      setIsProcessing(false);
    },
    onError: function (err) {
      console.error("Process error:", err);
      setIsProcessing(false);
    },
  });

  const logsData = logsQuery.data;
  const widgetsData = widgetsQuery.data;

  async function handleSubmit(e?: any) {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim()) return;
    setIsProcessing(true);
    processMutation.mutate({ rawContent: inputText, type: "text" });
  }

  async function handleFileUpload(e: any) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setPreviewFile(file);
    setIsProcessing(true);
    let fileText = "";
    const isTextBased =
      file.type.includes("text") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".txt");
    if (isTextBased && file.size < 500000) {
      try {
        const t = await file.text();
        fileText = t.slice(0, 4000);
      } catch (_) {
        fileText = "";
      }
    }
    const rawContent = fileText
      ? "File: " + file.name + "\n\n" + fileText
      : "Uploaded file: " +
        file.name +
        " (" +
        (file.size / 1024).toFixed(1) +
        "KB)";

    if (!rawContent.trim()) {
      setIsProcessing(false);
      return;
    }

    const uploadResult = await upload({ file });
    const fileUrl = uploadResult && !("error" in uploadResult) ? uploadResult.url : null;

    processMutation.mutate({
      rawContent: rawContent,
      type: "file",
      fileUrl,
    });
  }

  function getWidgetData(category: string, type: string) {
    const allLogs = (logsData && logsData.logs) || [];
    const logs = allLogs.filter(function (l: any) {
      return l.category === category;
    });
    if (type === "chart") {
      return logs
        .map(function (l: any) {
          return {
            date: new Date(l.timestamp).toLocaleDateString(),
            value: (l.entities && l.entities.amount) || 0,
          };
        })
        .reverse();
    }
    if (type === "list") {
      return logs.map(function (l: any) {
        return {
          text: l.raw_content,
          completed: false,
          date: new Date(l.timestamp).toLocaleDateString(),
        };
      });
    }
    if (type === "metric") {
      const last = logs[0];
      return {
        value:
          last && last.entities && last.entities.amount != null
            ? last.entities.amount
            : logs.length,
        unit: (last && last.entities && last.entities.currency) || "entries",
        sentiment: last && last.entities && last.entities.sentiment,
      };
    }
    return null;
  }

  const allLogs = (logsData && logsData.logs) || [];
  const conflicts = allLogs.filter(function (l: any) {
    return l.is_conflict;
  });
  const filteredLogs = selectedCategory
    ? allLogs.filter(function (l: any) {
        return l.category === selectedCategory;
      })
    : allLogs;
  const uniqueCategories = Array.from(
    new Set(
      allLogs.map(function (l: any) {
        return l.category;
      }),
    ),
  ) as string[];

  async function handleRevert(logId: string) {
    await fetch("/api/logs/" + logId, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["logs"] });
  }

  if (userLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Loading Codex...
          </span>
        </div>
      </div>
    );
  }

  const widgets = [...((widgetsData && widgetsData.widgets) || [])].sort(function (a: any, b: any) {
    if (widgetSort === "title") return a.title.localeCompare(b.title);
    if (widgetSort === "created") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (widgetSort === "recent") {
      const lastLog = (cat: string) => {
        const logs = allLogs.filter((l: any) => l.category === cat);
        return logs.length ? new Date(logs[0].timestamp).getTime() : 0;
      };
      return lastLog(b.config?.category) - lastLog(a.config?.category);
    }
    return 0;
  });

  return (
    <div className="flex h-screen w-full flex-col bg-black text-zinc-100 font-sans selection:bg-white selection:text-black">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-900 px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tighter">CODEX</h1>
          <div className="h-6 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <div
              className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            />
            Live
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isLogFeedPinned && (
            <button
              onClick={function () {
                setIsLogFeedPinned(true);
              }}
              className="flex h-8 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 text-xs font-bold text-zinc-400 hover:text-white transition-all"
            >
              <ScrollText size={14} />
              <span className="hidden md:inline">Log Feed</span>
            </button>
          )}
          <button
            onClick={function () {
              setShowConflicts(true);
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle size={15} />
            {conflicts.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
            ) : null}
          </button>
          <button className="hidden sm:flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-bold transition-all hover:bg-zinc-800">
            <Download size={13} /> Export PDF
          </button>
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={function () { setShowUserMenu(function (v) { return !v; }); }}
              className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden hover:border-zinc-500 transition-colors"
            >
              {user && user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Users size={15} />
              )}
            </button>
            <AnimatePresence>
              {showUserMenu ? (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  className="absolute right-0 top-10 z-50 w-56 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-zinc-800">
                    {user?.user_metadata?.full_name ? (
                      <p className="text-sm font-bold text-white truncate">{user.user_metadata.full_name}</p>
                    ) : null}
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={async function () {
                      const { createClient } = await import("@/utils/supabase/client");
                      await createClient().auth.signOut();
                      window.location.href = "/account/signin";
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex w-16 shrink-0 flex-col items-center border-r border-zinc-900 py-6">
          <div className="flex h-full flex-col items-center justify-between">
            <History
              size={18}
              className={timeValue < 100 ? "text-blue-500" : "text-zinc-600"}
            />
            <div className="relative flex-1 py-4 flex items-center justify-center">
              <input
                type="range"
                min="0"
                max="100"
                value={timeValue}
                onChange={function (e) {
                  setTimeValue(parseInt(e.target.value, 10));
                }}
                className="absolute opacity-0 cursor-pointer"
                style={{ width: "40px", height: "100%" }}
              />
              <div
                className="h-full w-1 rounded-full bg-zinc-900 overflow-hidden relative"
                style={{ minHeight: "120px" }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-300"
                  style={{ height: timeValue + "%" }}
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black text-zinc-600 uppercase">
                Now
              </span>
              <Clock size={14} className="text-zinc-600" />
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 pb-36 relative">
          {timeValue < 100 ? (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-blue-500/90 px-5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-xl backdrop-blur-md"
            >
              Snapshot:{" "}
              {new Date(
                Date.now() - (100 - timeValue) * 86400000,
              ).toLocaleDateString()}
            </motion.div>
          ) : null}
          <div className="columns-1 md:columns-2 xl:columns-3 gap-5 space-y-5">
            {widgets.length > 0 ? (
              <div className="break-inside-avoid mb-1 flex items-center justify-end">
                <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 p-1">
                  <ArrowUpDown size={11} className="text-zinc-600 ml-1.5" />
                  {(["title", "created", "recent"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setWidgetSort(opt)}
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                        widgetSort === opt
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {opt === "title" ? "A–Z" : opt === "created" ? "Created" : "Recent"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {widgets.map(function (widget: any) {
              const data = getWidgetData(
                widget.config && widget.config.category,
                widget.type,
              );
              const handleClick = function () {
                const cat = widget.config && widget.config.category;
                if (cat)
                  window.location.href = "/widget/" + encodeURIComponent(cat);
              };
              return (
                <div key={widget.id} className="break-inside-avoid">
                  {widget.type === "chart" ? (
                    <ChartWidget
                      title={widget.title}
                      data={data || []}
                      onClick={handleClick}
                    />
                  ) : null}
                  {widget.type === "list" ? (
                    <ListWidget
                      title={widget.title}
                      items={data || []}
                      onClick={handleClick}
                    />
                  ) : null}
                  {widget.type === "metric" ? (
                    <MetricCard
                      title={widget.title}
                      value={data && data.value}
                      unit={data && data.unit}
                      sentiment={data && data.sentiment}
                      onClick={handleClick}
                    />
                  ) : null}
                </div>
              );
            })}
            {widgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-zinc-700 py-16 border-2 border-dashed border-zinc-900 rounded-[36px]">
                <Package size={44} strokeWidth={1} className="mb-3" />
                <p className="text-sm font-medium">
                  Log something to seed your canvas
                </p>
              </div>
            ) : null}
          </div>
        </main>

        <AnimatePresence>
          {isLogFeedPinned && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="hidden xl:flex shrink-0 flex-col border-l border-zinc-900 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <ScrollText size={14} className="text-zinc-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    Log Feed
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                    {allLogs.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCategory ? (
                    <button
                      onClick={function () {
                        setSelectedCategory(null);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors"
                    >
                      <X size={10} /> Clear filter
                    </button>
                  ) : null}
                  <button
                    onClick={function () {
                      setIsLogFeedPinned(false);
                    }}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Unpin Log Feed"
                  >
                    <PinOff size={14} />
                  </button>
                </div>
              </div>

              {allLogs.length > 0 ? (
                <div
                  className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-zinc-900"

                >
                  {uniqueCategories.map(function (cat) {
                    const c = getCat(cat);
                    const active = selectedCategory === cat;
                    const cls = active
                      ? c.bg + " " + c.text + " " + c.border
                      : "border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400";
                    return (
                      <button
                        key={cat}
                        onClick={function () {
                          setSelectedCategory(active ? null : cat);
                        }}
                        className={
                          "shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all border " +
                          cls
                        }
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-36">
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                    <MessageSquare size={32} strokeWidth={1} className="mb-3" />
                    <p className="text-xs font-medium text-center">
                      {selectedCategory
                        ? "No logs for " + selectedCategory
                        : "No logs yet. Start by typing below."}
                    </p>
                  </div>
                ) : null}
                <AnimatePresence initial={false}>
                  {filteredLogs.map(function (log: any) {
                    return (
                      <LogFeedItem
                        key={log.id}
                        log={log}
                        allLogs={allLogs}
                        onClick={function () {
                          setPreviewLog(log);
                        }}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 z-30 flex justify-center p-5 pointer-events-none lg:left-16 transition-all duration-300 ${isLogFeedPinned ? "xl:right-80" : "xl:right-0"}`}>
        <div className="pointer-events-auto flex w-full max-w-2xl flex-col items-center gap-3">
          <AnimatePresence>
            {isProcessing ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/90 px-5 py-2 shadow-2xl backdrop-blur-xl"
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
                />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                  AI Processing...
                </span>
              </motion.div>
            ) : null}
            {!isProcessing && processMutation.isError ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-2 shadow-2xl backdrop-blur-xl"
              >
                <AlertCircle size={13} className="text-rose-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-rose-400">
                  {(processMutation.error && processMutation.error.message) ||
                    "Processing failed — try again"}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {previewFile ? (
            <div className="flex items-center gap-2 self-start rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5">
              <FileText size={12} className="text-zinc-400" />
              <button
                type="button"
                onClick={() => setShowFilePreview(true)}
                className="text-xs font-bold text-zinc-300 hover:text-white transition-colors max-w-[200px] truncate"
              >
                {previewFile.name}
              </button>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="group relative flex w-full flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl transition-all focus-within:border-zinc-700 focus-within:ring-4 focus-within:ring-white/5"
          >
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={function (e) {
                setInputText(e.target.value);
              }}
              onKeyDown={function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Log an expense, project update, client note..."
              className="w-full resize-none bg-transparent px-6 py-5 text-base font-medium text-white placeholder-zinc-600 outline-none max-h-[160px]"
              rows={1}
            />
            <div className="flex h-12 items-center justify-between border-t border-zinc-800/50 bg-zinc-900/40 px-5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 text-zinc-600 transition-colors hover:text-white rounded-xl hover:bg-zinc-800"
                >
                  <Mic size={18} />
                </button>
                <label className="cursor-pointer p-1.5 text-zinc-600 transition-colors hover:text-white rounded-xl hover:bg-zinc-800">
                  <FileUp size={18} />
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".csv,.txt,.pdf,.xlsx"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-[10px] text-zinc-700">
                  Enter to send
                </span>
                <button
                  disabled={!inputText.trim() || isProcessing}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all hover:scale-110 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:hover:scale-100"
                >
                  <Send size={15} fill="currentColor" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showConflicts ? (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed inset-y-0 right-0 z-[60] w-full max-w-sm border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-widest text-white">
                Conflicts
              </h2>
              <button
                onClick={function () {
                  setShowConflicts(false);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {conflicts.length === 0 ? (
                <p className="text-center text-zinc-600 py-16 text-sm font-medium">
                  No active conflicts.
                </p>
              ) : null}
              {conflicts.map(function (log: any) {
                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                      <AlertCircle size={12} /> Conflict
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {log.raw_content}
                    </p>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Why flagged</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {log.conflict_reason || (
                          <>Another <span className="font-bold text-zinc-300">{log.category}</span> entry was already logged today.</>
                        )}
                      </p>
                      {log.conflict_source_id ? (
                        (() => {
                          const src = allLogs.find((l: any) => l.id === log.conflict_source_id);
                          return src ? (
                            <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-1.5 mt-1">
                              Earlier entry: &ldquo;{src.raw_content.slice(0, 80)}{src.raw_content.length > 80 ? "..." : ""}&rdquo;
                            </p>
                          ) : null;
                        })()
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={function () {
                          setShowConflicts(false);
                        }}
                        className="flex-1 rounded-xl bg-amber-500 py-2 text-[11px] font-black text-black"
                      >
                        KEEP
                      </button>
                      <button
                        onClick={function () {
                          handleRevert(log.id);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-900 px-3 text-[11px] font-black text-zinc-400 hover:text-white transition-colors"
                      >
                        <RotateCcw size={12} /> REVERT
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {previewLog ? (
          <LogPreviewModal
            log={previewLog}
            allLogs={allLogs}
            onClose={function () {
              setPreviewLog(null);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showFilePreview && previewFile ? (
          <FilePreviewModal file={previewFile} onClose={() => setShowFilePreview(false)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
