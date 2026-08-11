// Shared chrome for a settings group, so the four tabs read as one surface
// rather than four pages that happen to share a nav.

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-5">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// A labelled control on its own row. `hint` carries the consequence of the
// setting where that isn't obvious from the label alone.
export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[13px] font-normal text-zinc-300">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs text-zinc-600">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
