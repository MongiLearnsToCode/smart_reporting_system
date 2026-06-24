'use client';

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Download, X } from "lucide-react";

export function FilePreviewModal({ file, fileUrl, fileName, onClose }: {
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
