'use client';

import { motion } from 'framer-motion';
import { ScrollText, X } from 'lucide-react';
import type { Log } from '@/lib/dashboard-utils';
import type { ConvexBlockDoc } from '@/utils/convex/adapters';

export function SourceBlockModal({ block, logs, onClose, onPreview }: {
  block: ConvexBlockDoc; logs: Log[]; onClose: () => void; onPreview: (log: Log) => void;
}) {
  const contributing = logs.filter((log) => !block.queryConfig.category || log.category === block.queryConfig.category);
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400"><ScrollText size={15} /></div><div><h2 className="text-[15px] font-semibold text-zinc-100">{block.title}</h2><p className="mt-0.5 text-xs text-zinc-500">Logs contributing to this block</p></div></div><button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={18} /></button></div>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">{contributing.map((log) => <button key={log.id} onClick={() => { onPreview(log); onClose(); }} className="block w-full rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3 text-left transition-colors hover:border-zinc-700"><p className="text-sm text-zinc-300 line-clamp-2">{log.raw_content}</p><p className="mt-1 font-mono text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleString()} · confidence {log.ai_confidence != null ? `${Math.round(log.ai_confidence * 100)}%` : '—'}</p></button>)}</div>
    </div>
  </motion.div>;
}
