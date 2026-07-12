"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowUp, Mic, Plus, FileUp, Square, X, FileText, Image } from "lucide-react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  onStop?: () => void;
  onMicClick?: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / 1048576).toFixed(1) + "MB";
}

export function Composer({
  value, onChange, onSubmit,
  files, onFilesAdded, onFileRemove,
  disabled, isProcessing, onStop, onMicClick,
}: ComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleDragIn = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.items.length) setIsDragging(true);
    };
    const handleDragOut = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer?.files.length) {
        onFilesAdded(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener("dragenter", handleDragIn);
    window.addEventListener("dragleave", handleDragOut);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragIn);
      window.removeEventListener("dragleave", handleDragOut);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onFilesAdded]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(
            new File([file], `pasted-image-${Date.now()}.${file.type.split("/")[1]}`, { type: file.type }),
          );
        }
      }
    }
    if (imageFiles.length) onFilesAdded(imageFiles);
  }, [onFilesAdded]);

  const handleFilePickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;
    onFilesAdded(Array.from(selectedFiles));
    e.target.value = "";
  }, [onFilesAdded]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Auto-grow the textarea with content, capped at ~7 lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  return (
    <>
      {isDragging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80">
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900 px-12 py-10 text-center">
            <FileUp size={32} className="mx-auto mb-3 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-200">Drop files here</p>
            <p className="mt-1 text-xs text-zinc-500">Attach to your log entry</p>
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="relative flex w-full flex-col rounded-xl border border-zinc-800 bg-zinc-900 transition-colors focus-within:border-zinc-600"
      >
        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {files.map((file, i) => (
              <div
                key={i}
                className="group/chip flex shrink-0 items-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-800/60 py-1.5 pl-2 pr-2.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-700/60 text-zinc-300">
                  {file.type.startsWith("image/") ? <Image size={13} /> : <FileText size={13} />}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="max-w-[130px] truncate text-xs font-medium text-zinc-200">{file.name}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{formatSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onFileRemove(i)}
                  aria-label={`Remove ${file.name}`}
                  className="ml-1 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Log an expense, project update, client note..."
          className="max-h-[200px] w-full resize-none appearance-none border-0 bg-transparent px-4 pb-1 pt-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-0 focus:outline-none focus:ring-0"
          rows={1}
          disabled={disabled}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <label
            aria-label="Attach files"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Plus size={16} />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePickerChange}
              accept=".csv,.txt,.pdf,.xlsx,image/*"
              multiple
            />
          </label>

          <div className="flex items-center gap-1.5">
            {onMicClick && (
              <button
                type="button"
                onClick={onMicClick}
                aria-label="Dictate"
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Mic size={16} />
              </button>
            )}
            {isProcessing ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/15 text-violet-300 transition-colors hover:bg-violet-500/25 hover:text-violet-200"
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={(!value.trim() && !files.length) || disabled}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/15 text-violet-300 transition-colors hover:bg-violet-500/25 hover:text-violet-200 disabled:border-transparent disabled:bg-zinc-800/60 disabled:text-zinc-600"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
