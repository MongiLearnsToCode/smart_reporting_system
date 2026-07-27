"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, FolderOpen, Plus, X } from "lucide-react";
import { BUSINESS_SCOPE_LABEL, type Project } from "@/lib/dashboard-utils";

export function scopeLabel(projectId: string | null, projects: Project[]) {
  if (!projectId) return BUSINESS_SCOPE_LABEL;
  return projects.find((p) => p.id === projectId)?.name ?? BUSINESS_SCOPE_LABEL;
}

interface ProjectScopePickerProps {
  value: string | null;
  projects: Project[];
  onChange: (projectId: string | null) => void;
  /** Creates the project and returns its id, so it can be selected immediately. */
  onCreate?: (name: string) => Promise<string>;
  /** `header` reads as a scope switcher, `composer` as an inline entry control. */
  variant?: "header" | "composer";
  disabled?: boolean;
  align?: "left" | "right";
}

export function ProjectScopePicker({
  value,
  projects,
  onChange,
  onCreate,
  variant = "composer",
  disabled,
  align = "left",
}: ProjectScopePickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  // Archived projects stay attached to their existing logs but must not clutter
  // the picker — except when one is the current scope.
  const selectable = projects.filter((p) => !p.archived || p.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (creating) draftRef.current?.focus();
  }, [creating]);

  function close() {
    setOpen(false);
    setCreating(false);
    setDraftName("");
    setError(null);
  }

  async function handleCreate() {
    const name = draftName.trim();
    if (!name || !onCreate) return;
    setBusy(true);
    setError(null);
    try {
      const id = await onCreate(name);
      onChange(id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  const label = scopeLabel(value, projects);
  const triggerClass =
    variant === "header"
      ? "flex h-8 max-w-[220px] items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
      : "flex h-8 max-w-[200px] items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Scope: ${label}`}
        title={`Scope: ${label}`}
        className={triggerClass}
      >
        {value ? (
          <FolderOpen size={13} className="shrink-0 text-violet-400" />
        ) : (
          <Building2 size={13} className="shrink-0 text-zinc-500" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0 text-zinc-600" />
      </button>

      {open ? (
        <div
          role="listbox"
          className={
            "absolute z-[70] w-64 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl " +
            (variant === "header" ? "top-10 " : "bottom-10 ") +
            (align === "right" ? "right-0" : "left-0")
          }
        >
          <div className="max-h-64 overflow-y-auto py-1">
            <ScopeOption
              icon={<Building2 size={13} className="text-zinc-500" />}
              label={BUSINESS_SCOPE_LABEL}
              hint="Applies to the whole company"
              selected={value === null}
              onSelect={() => {
                onChange(null);
                close();
              }}
            />
            {selectable.length ? (
              <div className="my-1 border-t border-zinc-800/80" />
            ) : null}
            {selectable.map((p) => (
              <ScopeOption
                key={p.id}
                icon={<FolderOpen size={13} className="text-violet-400" />}
                label={p.name}
                hint={p.archived ? "Archived" : p.description ?? undefined}
                selected={value === p.id}
                onSelect={() => {
                  onChange(p.id);
                  close();
                }}
              />
            ))}
          </div>

          {onCreate ? (
            <div className="border-t border-zinc-800/80 p-1">
              {creating ? (
                <div className="space-y-1.5 p-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={draftRef}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreate();
                        }
                      }}
                      maxLength={80}
                      placeholder="Project name"
                      className="h-7 w-full rounded border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!draftName.trim() || busy}
                      aria-label="Create project"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-violet-500/30 bg-violet-500/15 text-violet-300 transition-colors hover:bg-violet-500/25 disabled:opacity-40"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setDraftName("");
                        setError(null);
                      }}
                      aria-label="Cancel"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {error ? <p className="px-0.5 text-[11px] text-rose-400">{error}</p> : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  <Plus size={13} /> New project…
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScopeOption({
  icon,
  label,
  hint,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={
        "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-900 " +
        (selected ? "bg-zinc-900/60" : "")
      }
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={"block truncate text-xs font-medium " + (selected ? "text-zinc-100" : "text-zinc-300")}>
          {label}
        </span>
        {hint ? <span className="block truncate text-[11px] text-zinc-600">{hint}</span> : null}
      </span>
      {selected ? <Check size={13} className="mt-0.5 shrink-0 text-violet-400" /> : null}
    </button>
  );
}
