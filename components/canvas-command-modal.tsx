'use client';

import { useState } from "react";
import { Wand2, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/utils/client-integrations/shadcn-ui";
import { csrfFetch } from "@/utils/api/csrf";

const EXAMPLES = [
  "Show only my finance blocks",
  "Turn the expenses list into a chart",
  "Add a metric for open tasks",
  "Rename the weekly summary to Client Recap",
];

// AI natural-language canvas commands (spec §5 P1, Pro tier). The command is
// interpreted server-side and applied via block mutations; the canvas updates
// reactively, so this modal only needs to fire the request and report back.
export function CanvasCommandModal({ onClose }: { onClose: () => void }) {
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const res = await csrfFetch("/api/canvas/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      toast.success(data.note || "Done");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
        <DialogHeader className="space-y-0 border-b border-zinc-800/80 px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-400">
              <Wand2 size={15} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-zinc-100">
                Canvas command
              </DialogTitle>
              <p className="mt-0.5 text-xs font-normal text-zinc-500">
                Tell Codex how to reshape your canvas, in plain language
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Type a natural-language command to create, convert, rename, or hide canvas blocks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <form
            onSubmit={(e) => { e.preventDefault(); run(command); }}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 focus-within:border-violet-500/40"
          >
            <Wand2 size={14} className="shrink-0 text-zinc-600" />
            <input
              autoFocus
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. Show only client updates"
              disabled={busy}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
            {busy ? (
              <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            ) : (
              <button type="submit" className="shrink-0 text-zinc-600 hover:text-violet-300" title="Run">
                <CornerDownLeft size={14} />
              </button>
            )}
          </form>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Try</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setCommand(ex); run(ex); }}
                  disabled={busy}
                  className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
