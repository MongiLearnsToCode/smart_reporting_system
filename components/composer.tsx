"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Send, Mic, FileUp, Square, X, FileText, Image } from "lucide-react";

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

  return (
    <>
      {isDragging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="rounded-[36px] border-2 border-dashed border-zinc-600 bg-zinc-900/50 px-12 py-10 text-center">
            <FileUp size={36} className="mx-auto mb-3 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-300">Drop files here</p>
            <p className="text-xs text-zinc-600 mt-1">Attach to your log entry</p>
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="group relative flex w-full flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl transition-all focus-within:border-zinc-700 focus-within:ring-4 focus-within:ring-white/5"
      >
        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-5 pt-3 pb-1">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 shrink-0 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5"
              >
                {file.type.startsWith("image/") ? (
                  <Image size={12} className="text-zinc-400" />
                ) : (
                  <FileText size={12} className="text-zinc-400" />
                )}
                <span className="max-w-[120px] truncate text-xs text-zinc-300">{file.name}</span>
                <span className="text-[10px] text-zinc-500">{formatSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onFileRemove(i)}
                  className="ml-0.5 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={12} />
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
          className="w-full resize-none appearance-none border-0 bg-transparent px-6 py-5 text-base font-medium text-white placeholder-zinc-600 outline-none ring-0 focus:ring-0 focus:outline-none max-h-[160px]"
          rows={1}
          disabled={disabled}
        />

        <div className="flex h-12 items-center justify-between border-t border-zinc-800/50 bg-zinc-900/40 px-5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMicClick}
              className="p-1.5 text-zinc-600 transition-colors hover:text-white rounded-xl hover:bg-zinc-800"
            >
              <Mic size={18} />
            </button>
            <label className="cursor-pointer p-1.5 text-zinc-600 transition-colors hover:text-white rounded-xl hover:bg-zinc-800">
              <FileUp size={18} />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFilePickerChange}
                accept=".csv,.txt,.pdf,.xlsx,image/*"
                multiple
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-[10px] text-zinc-700">Enter to send</span>
            {isProcessing ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all hover:scale-110 active:scale-95"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!value.trim() && !files.length) || disabled}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all hover:scale-110 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:hover:scale-100"
              >
                <Send size={15} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
