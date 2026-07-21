'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch, Button, Label, Input, Separator, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  History,
  AlertCircle,
  Users,
  MessageSquare,
  Clock,
  X,
  AlertTriangle,
  RotateCcw,
  FileText,
  User,
  ScrollText,
  PinOff,
  LogOut, Sun, Moon,
  Settings,
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
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { csrfFetch, ensureCsrfToken } from "@/utils/api/csrf";
import { LogPreviewModal } from "@/components/log-preview-modal";
import { LogFeedItem } from "@/components/log-feed-item";
import { SettingsModal } from "@/components/settings-modal";
import { Composer } from "@/components/composer";
import { BlockCanvas } from "@/components/block-canvas";
import { getCat } from "@/lib/categories";
import { uniqueClients, logClients, type Log, type UserSettings } from "@/lib/dashboard-utils";
import { normalizeTier } from "@/lib/tiers";
import { useBlocks, useLogs, useLogMutations } from "@/utils/convex/hooks";
import type { ConvexBlockDoc } from "@/utils/convex/adapters";
import { ReportsModal } from "@/components/reports-modal";

export default function CodexApp() {
  const queryClient = useQueryClient();
  const userResult = useUser();

  useEffect(function () { ensureCsrfToken(); }, []);
  const user = userResult.data as import("@supabase/supabase-js").User | null;
  const userLoading = userResult.loading;
  const uploadHook = useUpload();
  const upload = uploadHook[0] as (input: { file: File }) => Promise<{ url: string; mimeType: string | null } | { error: string }>;

  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeValue, setTimeValue] = useState(100);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [previewLog, setPreviewLog] = useState<Log | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const [isLogFeedPinned, setIsLogFeedPinned] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [sourceBlock, setSourceBlock] = useState<ConvexBlockDoc | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useTheme();
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

  // Convex is the reactive source for logs + blocks (spec §7). No manual
  // refetching — subscriptions push updates within the 2s SLA.
  const { logs: allLogsRaw } = useLogs();
  const { blocks } = useBlocks();
  const logMutations = useLogMutations();

  // Time-travel slider filters the feed/canvas client-side to a past snapshot.
  const allLogs = useMemo(
    function () {
      if (timeValue >= 100) return allLogsRaw;
      const snapshot = Date.now() - (100 - timeValue) * 86400000;
      return allLogsRaw.filter((l) => new Date(l.timestamp).getTime() <= snapshot);
    },
    [allLogsRaw, timeValue],
  );

  // Pagination is obsolete under Convex reactivity; keep stubs so the feed JSX
  // renders unchanged.
  const hasMoreLogs = false;
  const isLoadingMore = false;
  function loadMoreLogs() {}

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: !!user,
    queryFn: async function () {
      const res = await fetch("/api/settings");
      return res.json();
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async function (payload: Partial<UserSettings>) {
      const res = await csrfFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      return data;
    },
    onSuccess: function (data: { settings?: UserSettings }) {
      queryClient.setQueryData(["settings"], data);
    },
  });

  const processMutation = useMutation({
    mutationFn: async function (payload: { rawContent: string; type: string; fileUrl?: string }) {
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await csrfFetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }
      return res.json();
    },
    // Convex reactivity updates the canvas + feed; no cache invalidation needed.
    onError: function (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Process error:", err);
      toast.error(err instanceof Error ? err.message : "Processing failed");
    },
  });

  const userSettings = (settingsQuery.data && settingsQuery.data.settings) || {};
  const tier = normalizeTier((userSettings as Partial<UserSettings>).tier);

  function handleFilesAdded(newFiles: File[]) {
    setFiles(function (prev) { return [...prev, ...newFiles]; });
  }

  function handleFileRemove(index: number) {
    setFiles(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsProcessing(false);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim() && files.length === 0) return;
    setIsProcessing(true);

    try {
      if (inputText.trim()) {
        await processMutation.mutateAsync({ rawContent: inputText, type: "text" });
      }

      for (const file of files) {
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

        const uploadResult = await upload({ file });
        if (!uploadResult || "error" in uploadResult) {
          toast.error(uploadResult?.error || "Upload failed for " + file.name);
          continue;
        }
        await processMutation.mutateAsync({
          rawContent: rawContent,
          type: "file",
          fileUrl: uploadResult.url,
        });
      }

      setInputText("");
      setFiles([]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  const conflicts = allLogs.filter(function (l: Log) {
    return l.is_conflict;
  });
  const filteredLogs = allLogs.filter(function (l: Log) {
    if (selectedCategory && l.category !== selectedCategory) return false;
    if (selectedClient && !logClients(l).includes(selectedClient)) return false;
    return true;
  });
  const uniqueCategories = Array.from(
    new Set(
      allLogs.map(function (l: Log) {
        return l.category;
      }),
    ),
  ) as string[];
  const clients = uniqueClients(allLogs);

  async function handleRevert(logId: string) {
    try {
      await logMutations.remove({ id: logId as never });
    } catch {
      toast.error("Could not revert conflict");
    }
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

  return (
    <div className="flex h-screen w-full flex-col bg-black text-zinc-100 font-sans selection:bg-white selection:text-black">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-900 px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-semibold tracking-[0.14em] text-zinc-100">CODEX</h1>
          <div className="h-5 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isLogFeedPinned && (
            <button
              onClick={function () {
                setIsLogFeedPinned(true);
              }}
              className="flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <ScrollText size={13} />
              <span className="hidden md:inline">Log Feed</span>
            </button>
          )}
          <button
            onClick={function () {
              setShowConflicts(true);
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle size={14} />
            {conflicts.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
            ) : null}
          </button>
          <button
            onClick={function () { setShowReports(true); }}
            className="hidden sm:flex h-8 items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20 hover:text-violet-200"
          >
            <FileText size={13} /> Reports
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
                  className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-zinc-800/80">
                    {user?.user_metadata?.full_name ? (
                      <p className="text-[13px] font-semibold text-zinc-100 truncate">{user.user_metadata.full_name}</p>
                    ) : null}
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={function () {
                      setShowUserMenu(false);
                      setShowSettings(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    onClick={function () { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Light' : 'Dark'} mode
                  </button>
                  <button
                    onClick={async function () {
                      const { createClient } = await import("@/utils/supabase/client");
                      await createClient().auth.signOut();
                      window.location.href = "/account/signin";
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
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
          <BlockCanvas blocks={blocks} logs={allLogs} onViewSource={setSourceBlock} tier={tier} />
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
                  <ScrollText size={13} className="text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Log Feed
                  </span>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {allLogs.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCategory || selectedClient ? (
                    <button
                      onClick={function () {
                        setSelectedCategory(null);
                        setSelectedClient(null);
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors"
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
                          "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all border " +
                          cls
                        }
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {clients.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto px-5 py-2.5 border-b border-zinc-900 items-center">
                  <User size={10} className="shrink-0 text-zinc-600" />
                  {clients.map(function (client) {
                    const active = selectedClient === client;
                    return (
                      <button
                        key={client}
                        onClick={function () {
                          setSelectedClient(active ? null : client);
                        }}
                        className={
                          "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-all " +
                          (active
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                            : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300")
                        }
                      >
                        {client}
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
                  {filteredLogs.map(function (log: Log) {
                    return (
                      <LogFeedItem
                        key={log.id}
                        log={log}
                        onClick={function () {
                          setPreviewLog(log);
                        }}
                      />
                    );
                  })}
                </AnimatePresence>
                {hasMoreLogs ? (
                  <button
                    onClick={loadMoreLogs}
                    disabled={isLoadingMore}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/40 py-2.5 text-xs font-medium text-zinc-500 transition-all hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-40"
                  >
                    {isLoadingMore ? "Loading…" : "Load more"}
                  </button>
                ) : null}
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
                className="flex items-center gap-2.5 rounded-full border border-violet-500/30 bg-zinc-900/90 px-4 py-1.5 shadow-2xl backdrop-blur-xl"
              >
                <div
                  className="h-3 w-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin"
                />
                <span className="text-xs font-medium text-violet-300">
                  Processing your log…
                </span>
              </motion.div>
            ) : null}
            {!isProcessing && processMutation.isError ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 shadow-2xl backdrop-blur-xl"
              >
                <AlertCircle size={13} className="text-rose-400" />
                <span className="text-xs font-medium text-rose-400">
                  {(processMutation.error && processMutation.error.message) ||
                    "Processing failed — try again"}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Composer
            value={inputText}
            onChange={setInputText}
            onSubmit={handleSubmit}
            files={files}
            onFilesAdded={handleFilesAdded}
            onFileRemove={handleFileRemove}
            isProcessing={isProcessing}
            onStop={handleStop}
          />
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
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
                  <AlertTriangle size={15} />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-100">Conflicts</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Entries that may duplicate or contradict earlier logs
                  </p>
                </div>
              </div>
              <button
                onClick={function () {
                  setShowConflicts(false);
                }}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {conflicts.length === 0 ? (
                <p className="text-center text-zinc-600 py-16 text-sm font-medium">
                  No active conflicts.
                </p>
              ) : null}
              {conflicts.map(function (log: Log) {
                return (
                  <div
                    key={log.id}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                      <AlertCircle size={11} /> Conflict
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {log.raw_content}
                    </p>
                    <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Why flagged</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {log.conflict_reason || (
                          <>Another <span className="font-medium text-zinc-300">{log.category}</span> entry was already logged today.</>
                        )}
                      </p>
                      {log.conflict_source_id ? (
                        (() => {
                          const src = allLogs.find((l: Log) => l.id === log.conflict_source_id);
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
                        className="flex-1 rounded-md border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 hover:text-amber-200"
                      >
                        Keep entry
                      </button>
                      <button
                        onClick={function () {
                          handleRevert(log.id);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-800 px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                      >
                        <RotateCcw size={12} /> Revert
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
        {sourceBlock ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
            onClick={function () { setSourceBlock(null); }}
          >
            <div
              className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
              onClick={function (e) { e.stopPropagation(); }}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                    <ScrollText size={15} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-100">{sourceBlock.title}</h2>
                    <p className="mt-0.5 text-xs text-zinc-500">Logs contributing to this block</p>
                  </div>
                </div>
                <button onClick={function () { setSourceBlock(null); }} className="text-zinc-500 hover:text-zinc-200">
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
                {allLogs
                  .filter((l) => !sourceBlock.queryConfig?.category || l.category === sourceBlock.queryConfig.category)
                  .map((l) => (
                    <button
                      key={l.id}
                      onClick={function () { setPreviewLog(l); setSourceBlock(null); }}
                      className="block w-full rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3 text-left transition-colors hover:border-zinc-700"
                    >
                      <p className="text-sm text-zinc-300 line-clamp-2">{l.raw_content}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">
                        {new Date(l.timestamp).toLocaleString()} · confidence{" "}
                        {l.ai_confidence != null ? Math.round(l.ai_confidence * 100) + "%" : "—"}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showReports ? (
        <ReportsModal blocks={blocks} logs={allLogs} onClose={function () { setShowReports(false); }} />
      ) : null}

      {showSettings ? (
        <SettingsModal
          settings={{
            currency: "USD",
            timezone: "UTC",
            ai_language: "English",
            conflict_detection: true,
            conflict_dismiss_days: 7,
            default_widget_sort: "title",
            canvas_density: "comfortable",
            data_retention_days: 90,
            tier: "free",
            ...userSettings,
          }}
          onSave={async (s: Partial<UserSettings>) => { await settingsMutation.mutateAsync(s); }}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </div>
  );
}
