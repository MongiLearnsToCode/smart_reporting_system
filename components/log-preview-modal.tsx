'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Calendar, TrendingUp, Zap, User, Tag,
  FileText, MessageSquare, AlertTriangle, X,
} from "lucide-react";
import { getCat } from "@/lib/categories";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { type Log } from "@/lib/dashboard-utils";

export function LogPreviewModal({ log, onClose, allLogs }: {
  log: Log | null;
  onClose: () => void;
  allLogs: Log[];
}) {
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
        className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={function (e) {
          e.stopPropagation();
        }}
      >
        <div className="px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={
                  "h-8 w-8 shrink-0 rounded-md flex items-center justify-center " +
                  cat.bg
                }
              >
                {log.type === "file" ? (
                  <FileText size={15} className={cat.text} />
                ) : (
                  <MessageSquare size={15} className={cat.text} />
                )}
              </div>
              <div>
                <span className={"text-[13px] font-semibold " + cat.text}>
                  {log.category}
                </span>
                <p className="font-mono text-[10.5px] text-zinc-500 mt-0.5">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {log.is_conflict ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                  <AlertTriangle size={10} /> Conflict
                </div>
              ) : null}
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-md border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 border-b border-zinc-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-3">
            Raw Log
          </p>
          <p className="text-zinc-200 text-[13px] leading-relaxed whitespace-pre-wrap">
            {log.raw_content}
          </p>
          {log.file_url ? (
            <button
              onClick={function () { setShowAttachment(true); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <FileText size={12} /> View attached file
            </button>
          ) : null}
        </div>
        {log.is_conflict ? (
          <div className="px-6 py-4 border-b border-zinc-800/80 bg-amber-500/5">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={11} className="text-amber-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                Why this is flagged
              </p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {log.conflict_reason || (
                <>Another <span className="font-medium text-zinc-300">{log.category}</span> entry was already logged earlier today. This entry may duplicate or contradict it.</>
              )}
            </p>
            {log.conflict_source_id && allLogs ? (
              (() => {
                const src = allLogs.find((l: Log) => l.id === log.conflict_source_id);
                return src ? (
                  <div className="mt-3 rounded-md border border-amber-500/20 bg-zinc-900/60 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-1">Conflicting entry</p>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{src.raw_content}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">{new Date(src.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                ) : null;
              })()
            ) : null}
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-3">
              Extracted Data
            </p>
            <div className="grid grid-cols-2 gap-3">
              {items.map(function (item) {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} className="text-zinc-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-zinc-200 capitalize truncate">
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
