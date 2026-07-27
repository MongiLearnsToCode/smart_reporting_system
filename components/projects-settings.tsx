"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Check,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useProjects, useProjectMutations, useDefaultScope } from "@/utils/convex/hooks";
import { ProjectScopePicker } from "@/components/project-scope-picker";
import type { Project } from "@/lib/dashboard-utils";

// Projects + default entry scope. Unlike the rest of Settings — which lives in
// the Supabase user_metadata blob — these are Convex documents, so this section
// talks to Convex directly instead of going through the settings form state.
export function ProjectsSettings() {
  const { projects } = useProjects();
  const { defaultProjectId, setDefaultScope } = useDefaultScope();
  const { create, update, setArchived, remove } = useProjectMutations();

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  }

  async function handleAdd() {
    const name = draftName.trim();
    if (!name) return;
    if (await run(() => create({ name }))) {
      setDraftName("");
      setAdding(false);
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    if (await run(() => update({ id: id as never, name }))) setEditingId(null);
  }

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        Projects &amp; Scope
      </p>

      <div className="space-y-2">
        <div>
          <p className="text-[13px] text-zinc-300">Default scope for new entries</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            Where the composer starts each session. You can still change it per entry.
          </p>
        </div>
        <ProjectScopePicker
          variant="header"
          value={defaultProjectId}
          projects={projects}
          onChange={(id) => run(() => setDefaultScope(id))}
        />
      </div>

      <div className="space-y-1.5 border-t border-zinc-800/80 pt-3">
        {active.length === 0 && archived.length === 0 ? (
          <p className="py-2 text-xs text-zinc-600">
            No projects yet. Everything you log is filed under the business as a whole.
          </p>
        ) : null}

        {active.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            isDefault={defaultProjectId === p.id}
            editing={editingId === p.id}
            editName={editName}
            onEditNameChange={setEditName}
            onStartEdit={() => {
              setEditingId(p.id);
              setEditName(p.name);
              setError(null);
            }}
            onCancelEdit={() => setEditingId(null)}
            onCommitEdit={() => handleRename(p.id)}
            onArchive={() => run(() => setArchived({ id: p.id as never, archived: true }))}
            confirmingDelete={confirmDeleteId === p.id}
            onRequestDelete={() => {
              setConfirmDeleteId(p.id);
              setError(null);
            }}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onConfirmDelete={async () => {
              if (await run(() => remove({ id: p.id as never }))) setConfirmDeleteId(null);
            }}
          />
        ))}

        {archived.length ? (
          <div className="space-y-1.5 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-600">
              Archived
            </p>
            {archived.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-zinc-800/60 bg-zinc-900/40 px-3 py-2"
              >
                <Archive size={13} className="shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-500">{p.name}</span>
                <IconButton
                  label={`Restore ${p.name}`}
                  onClick={() => run(() => setArchived({ id: p.id as never, archived: false }))}
                >
                  <ArchiveRestore size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setDraftName("");
              }
            }}
            maxLength={80}
            placeholder="Project name"
            className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-[13px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <IconButton label="Save project" onClick={handleAdd} disabled={!draftName.trim()} accent>
            <Check size={14} />
          </IconButton>
          <IconButton
            label="Cancel"
            onClick={() => {
              setAdding(false);
              setDraftName("");
              setError(null);
            }}
          >
            <X size={14} />
          </IconButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-800 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
        >
          <Plus size={13} /> New project
        </button>
      )}

      {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}
    </section>
  );
}

function ProjectRow({
  project,
  isDefault,
  editing,
  editName,
  onEditNameChange,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onArchive,
  confirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  project: Project;
  isDefault: boolean;
  editing: boolean;
  editName: string;
  onEditNameChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onArchive: () => void;
  confirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (confirmingDelete) {
    return (
      <div className="space-y-2 rounded-md border border-rose-500/25 bg-rose-500/5 px-3 py-2.5">
        <p className="text-xs text-zinc-300">
          Delete <span className="font-medium text-zinc-100">{project.name}</span>? Its entries
          are kept and revert to the business as a whole.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirmDelete}
            className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
          >
            Delete project
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="rounded border border-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
      <FolderOpen size={13} className="shrink-0 text-violet-400" />
      {editing ? (
        <>
          <input
            autoFocus
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitEdit();
              }
              if (e.key === "Escape") onCancelEdit();
            }}
            maxLength={80}
            className="h-7 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-600"
          />
          <IconButton label="Save name" onClick={onCommitEdit} disabled={!editName.trim()} accent>
            <Check size={13} />
          </IconButton>
          <IconButton label="Cancel rename" onClick={onCancelEdit}>
            <X size={13} />
          </IconButton>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{project.name}</span>
          {isDefault ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-300">
              <Building2 size={9} /> Default
            </span>
          ) : null}
          <IconButton label={`Rename ${project.name}`} onClick={onStartEdit}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label={`Archive ${project.name}`} onClick={onArchive}>
            <Archive size={13} />
          </IconButton>
          <IconButton label={`Delete ${project.name}`} onClick={onRequestDelete} danger>
            <Trash2 size={13} />
          </IconButton>
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  accent,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  const tone = accent
    ? "border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
    : danger
      ? "border-transparent text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
      : "border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}
