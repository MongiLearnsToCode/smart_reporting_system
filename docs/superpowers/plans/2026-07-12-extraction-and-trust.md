# Extraction & Trust Upgrade — Implementation Plan

**Date:** 2026-07-12
**Spec:** `docs/superpowers/specs/2026-07-12-extraction-and-trust-design.md` (approved, commit 0466315)
**Goal:** Multi-entity extraction in the Novos PRD schema, confidence scoring with a review prompt, a user-correction loop with an audit trail, and report exclusion.

## Architecture overview

- `logs.entities` becomes a JSONB **array** of PRD-schema entity objects. New log columns: `ai_confidence numeric`, `processing_status text` (`pending|processed|needs_review|failed`), `excluded_from_reports boolean`.
- `logs.category` stays = **primary category** (category of the highest-confidence entity).
- New server modules: `utils/api/entity-normalizer.ts`, `utils/api/date-reference.ts`, `utils/api/corrections.ts`. `utils/api/groq.ts` gains tiered model routing.
- New accessor layer in `lib/dashboard-utils.ts` (`entitiesOf`, `primaryEntity`, `logClients`, `logAmount`, `logSentiment`, `logUrgency`) — the only place that understands both the array shape and the legacy single-object shape.
- `POST /api/process` rewritten: multi-entity prompt, normalizer, deterministic date resolution, confidence/status, failure path saving `processing_status='failed'`, retry via `{ logId }`. Settings read from `user.user_metadata.settings` (the `user_settings` table has no grants — known bug fixed here).
- New `PATCH /api/logs/[id]`: per-field corrections with audit, primary-category recompute, `needs_review → processed` flip, `excluded_from_reports` toggle.
- UI: feed status chips (`review`, `Failed · retry`), Original Log Modal (confidence badge, per-entity correction cards, exclude switch).

## Global constraints

- **Tests:** `npx vitest run` (49 existing tests must stay green throughout). Do NOT run `npm run build` (root disk ~98% full).
- **Migration:** I cannot run DDL. The user runs `migrations/2026-07-12-extraction-and-trust.sql` in the Supabase dashboard SQL editor. Code that queries the new columns/array shape must not be **deployed** before the migration runs; local work order doesn't matter.
- **Design language:** UI_Inspo control-room — layered zinc + borders, muted accent tints, quiet ≤15px type, mono for data.
- **Branding:** keep "Codex".
- Commit after each task with a conventional-commit message.

---

## Task 1: Migration SQL + schema doc

No tests (SQL only). Create the migration file the user will run, and update `supabase_init.sql` so fresh installs match.

**Create `migrations/2026-07-12-extraction-and-trust.sql`:**

```sql
-- Extraction & Trust upgrade (Novos PRD sub-project 1).
-- Run in the Supabase dashboard SQL editor. Idempotent where Postgres allows.
begin;

-- 1. New log-level columns
alter table public.logs
  add column if not exists ai_confidence numeric,
  add column if not exists processing_status text not null default 'processed',
  add column if not exists excluded_from_reports boolean not null default false;

do $$
begin
  alter table public.logs
    add constraint logs_processing_status_check
    check (processing_status in ('pending', 'processed', 'needs_review', 'failed'));
exception
  when duplicate_object then null;
end $$;

-- 2. One-time category remap: Inventory/Team -> Operations
update public.logs set category = 'Operations' where category in ('Inventory', 'Team');
update public.widgets set title = 'Operations' where title in ('Inventory', 'Team');
update public.widgets
  set config = jsonb_set(config, '{category}', '"Operations"')
  where config->>'category' in ('Inventory', 'Team');
update public.categories set name = 'Operations'
  where name in ('Inventory', 'Team')
  and not exists (
    select 1 from public.categories c2
    where c2.user_id = categories.user_id and c2.name = 'Operations'
  );
delete from public.categories where name in ('Inventory', 'Team');

-- 3. Wrap legacy single-object entities into one-element PRD entity arrays.
--    type: amount present -> expense, else note. confidence 0.8 so old logs
--    are 'processed', never 'needs_review'. Runs only on object-shaped rows,
--    so re-running is a no-op.
update public.logs
set
  entities = jsonb_build_array(
    coalesce(entities, '{}'::jsonb) || jsonb_build_object(
      'type', case when entities->>'amount' is not null then 'expense' else 'note' end,
      'category', coalesce(nullif(category, ''), 'Other'),
      'date_reference', null,
      'confidence', 0.8
    )
  ),
  ai_confidence = 0.8
where jsonb_typeof(entities) = 'object';

update public.logs
set entities = '[]'::jsonb, ai_confidence = 0.8
where entities is null or jsonb_typeof(entities) not in ('array', 'object');

-- 4. GIN index for entity containment queries (reports client filter uses @>)
create index if not exists logs_entities_gin_idx
  on public.logs using gin (entities jsonb_path_ops);

commit;
```

**Update `supabase_init.sql`** — replace the logs table block (lines 26–50) with:

```sql
-- Logs
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_content text not null,
  type text,
  file_url text,
  category text,
  -- Array of extracted entity objects (see utils/api/entity-normalizer.ts)
  entities jsonb,
  ai_confidence numeric,
  processing_status text not null default 'processed'
    check (processing_status in ('pending', 'processed', 'needs_review', 'failed')),
  excluded_from_reports boolean not null default false,
  is_conflict boolean not null default false,
  conflict_source_id uuid references public.logs(id),
  conflict_reason text,
  timestamp timestamptz not null default now()
);

alter table public.logs enable row level security;

create policy "Users can manage their own logs"
  on public.logs for all
  using (auth.uid() = user_id);

create index if not exists logs_user_timestamp_idx
  on public.logs (user_id, timestamp desc);

create index if not exists logs_user_category_timestamp_idx
  on public.logs (user_id, category, timestamp desc);

create index if not exists logs_entities_gin_idx
  on public.logs using gin (entities jsonb_path_ops);
```

**Verify:** `npx vitest run` still green (nothing imports these files).
**Commit:** `feat(db): migration for multi-entity extraction, confidence, and report exclusion`

---

## Task 2: Categories rewrite (PRD set)

**Write the failing test first** — create `test/lib/categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_COLORS_DETAIL, getCat, getCatDetail } from '../../lib/categories';

describe('CATEGORIES', () => {
  it('is exactly the PRD set', () => {
    expect(CATEGORIES).toEqual(['Finance', 'Projects', 'Clients', 'Tasks', 'Operations', 'Marketing', 'Other']);
  });

  it('has colors for every category and no legacy entries', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS_DETAIL[cat].chart).toMatch(/^#/);
    }
    expect(CATEGORY_COLORS.Inventory).toBeUndefined();
    expect(CATEGORY_COLORS.Team).toBeUndefined();
  });
});

describe('getCat', () => {
  it('maps PRD colors: Operations cyan, Marketing pink, Other zinc', () => {
    expect(getCat('Operations').text).toBe('text-cyan-400');
    expect(getCat('Marketing').text).toBe('text-pink-400');
    expect(getCat('Other').text).toBe('text-zinc-400');
  });

  it('falls back to zinc for unknown categories', () => {
    expect(getCat('Bogus').text).toBe('text-zinc-400');
    expect(getCatDetail('Bogus').chart).toBe('#a1a1aa');
  });
});
```

Run `npx vitest run test/lib/categories.test.ts` — fails (`CATEGORIES` not exported).

**Rewrite `lib/categories.ts`:**

```ts
export const CATEGORIES = [
  "Finance", "Projects", "Clients", "Tasks", "Operations", "Marketing", "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_COLORS: Record<string, {
  bg: string;
  text: string;
  dot: string;
  border: string;
  chart?: string;
}> = {
  Finance: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/30" },
  Projects: { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/30" },
  Clients: { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400", border: "border-purple-500/30" },
  Tasks: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-500/30" },
  Operations: { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400", border: "border-cyan-500/30" },
  Marketing: { bg: "bg-pink-500/15", text: "text-pink-400", dot: "bg-pink-400", border: "border-pink-500/30" },
  Other: { bg: "bg-zinc-500/15", text: "text-zinc-400", dot: "bg-zinc-400", border: "border-zinc-500/30" },
};

export const CATEGORY_COLORS_DETAIL: Record<string, {
  bg: string;
  text: string;
  dot: string;
  border: string;
  chart: string;
}> = {
  Finance: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/30", chart: "#34d399" },
  Projects: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/30", chart: "#60a5fa" },
  Clients: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400", border: "border-purple-500/30", chart: "#a78bfa" },
  Tasks: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-500/30", chart: "#fb923c" },
  Operations: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400", border: "border-cyan-500/30", chart: "#22d3ee" },
  Marketing: { bg: "bg-pink-500/10", text: "text-pink-400", dot: "bg-pink-400", border: "border-pink-500/30", chart: "#f472b6" },
  Other: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400", border: "border-zinc-500/30", chart: "#a1a1aa" },
};

export function getCat(cat: string) {
  return (
    CATEGORY_COLORS[cat] || {
      bg: "bg-zinc-500/15",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
    }
  );
}

export function getCatDetail(cat: string) {
  return (
    CATEGORY_COLORS_DETAIL[cat] || {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
      chart: "#a1a1aa",
    }
  );
}
```

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(categories): adopt PRD category set (Operations/Other; drop Inventory/Team)`

---

## Task 3: Entity types + accessors in `lib/dashboard-utils.ts`

**Write failing tests** — append to `test/lib/dashboard-utils.test.ts` (keep the existing `log` fixture and `uniqueClients` tests; extend the import line):

```ts
import { describe, expect, it } from 'vitest';
import {
  entitiesOf, logAmount, logClients, logSentiment, logUrgency,
  primaryEntity, uniqueClients, type Log, type LogEntity,
} from '../../lib/dashboard-utils';

function entity(overrides: Partial<LogEntity>): LogEntity {
  return {
    type: 'note', category: 'Other', date: null, date_reference: null,
    amount: null, currency: null, client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null,
    sentiment: null, urgency: null, confidence: 0.9,
    ...overrides,
  };
}

describe('entitiesOf', () => {
  it('returns entity arrays as-is', () => {
    const e = [entity({ type: 'expense' })];
    expect(entitiesOf(log({ entities: e }))).toBe(e);
  });

  it('wraps a legacy single object, inferring type from amount', () => {
    const wrapped = entitiesOf(log({ category: 'Finance', entities: { amount: 50, currency: 'ZAR', client: 'Acme' } as never }));
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]).toMatchObject({ type: 'expense', category: 'Finance', amount: 50, currency: 'ZAR', client: 'Acme', confidence: 0.8 });
    const note = entitiesOf(log({ category: 'Tasks', entities: { sentiment: 'positive' } as never }));
    expect(note[0].type).toBe('note');
  });

  it('returns [] for missing or empty entities', () => {
    expect(entitiesOf(log({}))).toEqual([]);
    expect(entitiesOf(log({ entities: {} as never }))).toEqual([]);
    expect(entitiesOf(log({ entities: [] }))).toEqual([]);
  });
});

describe('primaryEntity', () => {
  it('returns the highest-confidence entity', () => {
    const l = log({ entities: [entity({ confidence: 0.6, category: 'Tasks' }), entity({ confidence: 0.95, category: 'Finance' })] });
    expect(primaryEntity(l)?.category).toBe('Finance');
  });

  it('returns null when there are no entities', () => {
    expect(primaryEntity(log({}))).toBeNull();
  });
});

describe('log accessors', () => {
  it('logClients dedupes trimmed clients across entities', () => {
    const l = log({ entities: [entity({ client: ' Acme ' }), entity({ client: 'Acme' }), entity({ client: 'Zenith' }), entity({})] });
    expect(logClients(l)).toEqual(['Acme', 'Zenith']);
  });

  it('logAmount sums amounts and takes the first currency', () => {
    const l = log({ entities: [entity({ amount: 100, currency: 'ZAR' }), entity({ amount: 50 }), entity({})] });
    expect(logAmount(l)).toEqual({ amount: 150, currency: 'ZAR' });
    expect(logAmount(log({ entities: [entity({})] }))).toBeNull();
  });

  it('logSentiment/logUrgency read the primary entity', () => {
    const l = log({ entities: [entity({ confidence: 0.5, sentiment: 'negative', urgency: 'high' }), entity({ confidence: 0.9, sentiment: 'positive', urgency: 'low' })] });
    expect(logSentiment(l)).toBe('positive');
    expect(logUrgency(l)).toBe('low');
  });
});

describe('uniqueClients (entity arrays)', () => {
  it('collects clients from entity arrays and legacy objects', () => {
    const logs = [
      log({ entities: [entity({ client: 'Meridian Corp' })] }),
      log({ entities: { client: '  Acme Studios ' } as never }),
      log({ entities: [entity({ client: 'Meridian Corp' })] }),
    ];
    expect(uniqueClients(logs)).toEqual(['Meridian Corp', 'Acme Studios']);
  });
});
```

Run — fails (accessors don't exist).

**Update `lib/dashboard-utils.ts`** — replace the `Log`/`Entities` block (lines 16–49) with:

```ts
export const ENTITY_TYPES = [
  "expense", "income", "task", "client_update", "project_update", "risk", "note",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_STATUSES = ["open", "in_progress", "complete", "blocked"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export type ProcessingStatus = "pending" | "processed" | "needs_review" | "failed";

export type EntityCorrection = { from: unknown; to: unknown; at: string };

export type LogEntity = {
  type: EntityType;
  category: string;
  date: string | null;
  date_reference: string | null;
  amount: number | null;
  currency: string | null;
  client: string | null;
  project: string | null;
  task: string | null;
  status: EntityStatus | null;
  issue_or_risk: string | null;
  deliverable: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  urgency: "low" | "medium" | "high" | null;
  confidence: number;
  corrections?: Record<string, EntityCorrection>;
  names?: string[];
  tags?: string[];
};

/** Pre-migration single-object shape; tolerated at read time only. */
export type Entities = {
  amount?: number;
  currency?: string;
  date?: string;
  sentiment?: string;
  urgency?: string;
  client?: string | null;
  names?: string[];
  tags?: string[];
};

export type Log = {
  id: string;
  user_id: string;
  raw_content: string;
  type: string;
  file_url?: string;
  category: string;
  entities?: LogEntity[] | Entities;
  ai_confidence?: number | null;
  processing_status?: ProcessingStatus;
  excluded_from_reports?: boolean;
  is_conflict: boolean;
  conflict_source_id?: string;
  conflict_reason?: string;
  timestamp: string;
};

function legacyToEntity(e: Entities, category: string): LogEntity {
  return {
    type: e.amount != null ? "expense" : "note",
    category: category || "Other",
    date: e.date ?? null,
    date_reference: null,
    amount: e.amount ?? null,
    currency: e.currency ?? null,
    client: typeof e.client === "string" ? e.client : null,
    project: null,
    task: null,
    status: null,
    issue_or_risk: null,
    deliverable: null,
    sentiment: (e.sentiment as LogEntity["sentiment"]) ?? null,
    urgency: (e.urgency as LogEntity["urgency"]) ?? null,
    confidence: 0.8,
    names: e.names,
    tags: e.tags,
  };
}

/** The single place that understands both entity storage shapes. */
export function entitiesOf(log: Log): LogEntity[] {
  const e = log.entities;
  if (Array.isArray(e)) return e;
  if (e && typeof e === "object" && Object.keys(e).length > 0) {
    return [legacyToEntity(e, log.category)];
  }
  return [];
}

export function primaryEntity(log: Log): LogEntity | null {
  const list = entitiesOf(log);
  if (list.length === 0) return null;
  return list.reduce((best, e) => ((e.confidence ?? 0) > (best.confidence ?? 0) ? e : best));
}

export function logClients(log: Log): string[] {
  const seen: string[] = [];
  for (const e of entitiesOf(log)) {
    const client = typeof e.client === "string" ? e.client.trim() : "";
    if (client && !seen.includes(client)) seen.push(client);
  }
  return seen;
}

export function logAmount(log: Log): { amount: number; currency: string | null } | null {
  let total = 0;
  let currency: string | null = null;
  let found = false;
  for (const e of entitiesOf(log)) {
    if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
      total += e.amount;
      found = true;
      if (!currency && e.currency) currency = e.currency;
    }
  }
  return found ? { amount: total, currency } : null;
}

export function logSentiment(log: Log): LogEntity["sentiment"] {
  return primaryEntity(log)?.sentiment ?? null;
}

export function logUrgency(log: Log): LogEntity["urgency"] {
  return primaryEntity(log)?.urgency ?? null;
}

/** Distinct client names from a set of logs, most recent first. */
export function uniqueClients(logs: Log[]): string[] {
  const seen = new Set<string>();
  for (const log of logs) {
    for (const client of logClients(log)) seen.add(client);
  }
  return Array.from(seen);
}
```

(Keep `formatTimeAgo`, `CURRENCIES`/`TIMEZONES`/`LANGUAGES`, `Widget`, `WidgetConfig`, `UserSettings` unchanged.)

**Verify:** `npx vitest run` — all green (old `uniqueClients` tests pass because legacy objects still resolve through `entitiesOf`).
**Commit:** `feat(logs): LogEntity types and entity accessors over both storage shapes`

---

## Task 4: Migrate consumers to accessors

No new tests (behavior-preserving refactor; covered by existing component tests + task 3 units). Three files:

**`app/page.tsx`:**

1. Import line 53 becomes:
   ```ts
   import { formatTimeAgo, uniqueClients, logAmount, logClients, logSentiment, type Log, type Widget, type UserSettings } from "@/lib/dashboard-utils";
   ```
   (drops `type Entities`.)
2. `getWidgetData` (lines 325–360): replace entity reads:
   ```ts
   function getWidgetData(category: string, type: string) {
     const logs = allLogs.filter(function (l: Log) {
       return l.category === category;
     });
     if (type === "chart") {
       return logs
         .map(function (l: Log) {
           return {
             date: new Date(l.timestamp).toLocaleDateString(),
             value: logAmount(l)?.amount || 0,
           };
         })
         .reverse();
     }
     if (type === "list") {
       return logs.map(function (l: Log) {
         return {
           text: l.raw_content,
           completed: false,
           date: new Date(l.timestamp).toLocaleDateString(),
         };
       });
     }
     if (type === "metric") {
       const last = logs[0];
       const amount = last ? logAmount(last) : null;
       return {
         value: amount ? amount.amount : logs.length,
         unit: amount?.currency || "entries",
         sentiment: last ? logSentiment(last) ?? undefined : undefined,
       };
     }
     return null;
   }
   ```
3. `filteredLogs` client filter (line 367):
   ```ts
   if (selectedClient && !logClients(l).includes(selectedClient)) return false;
   ```

**`components/log-feed-item.tsx`** — replace all `log.entities.*` reads with accessors (full status-chip rework happens in Task 12; here only the accessor swap so arrays render):

```tsx
'use client';

import { motion } from "framer-motion";
import { FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { getCat } from "@/lib/categories";
import { formatTimeAgo, logAmount, logClients, logSentiment, logUrgency, type Log } from "@/lib/dashboard-utils";

export function LogFeedItem({ log, onClick }: {
  log: Log;
  onClick: () => void;
}) {
  const cat = getCat(log.category);
  const preview =
    log.raw_content && log.raw_content.length > 80
      ? log.raw_content.slice(0, 80) + "…"
      : log.raw_content;
  const timeAgo = formatTimeAgo(log.timestamp);
  const sentiment = logSentiment(log);
  const urgency = logUrgency(log);
  const amount = logAmount(log);
  const client = logClients(log)[0];
  const sentBg =
    sentiment === "positive"
      ? "bg-emerald-500/10 text-emerald-400"
      : sentiment === "negative"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-zinc-800 text-zinc-500";
  const urgBg =
    urgency === "high"
      ? "bg-rose-500/10 text-rose-400"
      : "bg-amber-500/10 text-amber-400";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="group w-full text-left rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={"h-1.5 w-1.5 rounded-full " + cat.dot} />
          <span className={"text-[11px] font-medium " + cat.text}>
            {log.category}
          </span>
          {client ? (
            <span className="max-w-[90px] truncate rounded-full border border-zinc-800 px-1.5 py-px text-[10px] font-medium capitalize text-zinc-500">
              {client}
            </span>
          ) : null}
          {log.type === "file" ? (
            <FileText size={10} className="text-zinc-600" />
          ) : null}
          {log.is_conflict ? (
            <AlertTriangle size={10} className="text-amber-400" />
          ) : null}
        </div>
        <span className="font-mono text-[10px] text-zinc-600">{timeAgo}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
        {preview}
      </p>
      {amount ? (
        <p className="mt-2 font-mono text-[13px] font-medium text-zinc-100">
          {(amount.currency || "$") + " "}
          {amount.amount.toLocaleString()}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {sentiment ? (
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " + sentBg}>
              {sentiment}
            </span>
          ) : null}
          {urgency && urgency !== "low" ? (
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium capitalize " + urgBg}>
              {urgency}
            </span>
          ) : null}
        </div>
        <ChevronRight
          size={12}
          className="text-zinc-700 group-hover:text-zinc-500 transition-colors"
        />
      </div>
    </motion.button>
  );
}
```

Note: the unused `allLogs` prop is dropped — remove `allLogs={allLogs}` from the `<LogFeedItem>` call site in `app/page.tsx` (line ~776–784).

**`app/widget/[category]/page.tsx`:**

1. Delete the local `CATEGORY_COLORS` map and `getCat` (lines 34–96); add imports:
   ```ts
   import { getCatDetail } from "@/lib/categories";
   import { entitiesOf, logAmount, logSentiment, logUrgency, type Log, type LogEntity } from "@/lib/dashboard-utils";
   ```
   and replace both `getCat(category)` calls with `getCatDetail(category)`.
2. Replace `LogDetailCard` with an entity-array version:
   ```tsx
   function LogDetailCard({ log }: { log: Log }) {
     const entities = entitiesOf(log);
     const sentiment = logSentiment(log);
     const urgency = logUrgency(log);

     const sentColor =
       sentiment === "positive"
         ? "text-emerald-400"
         : sentiment === "negative"
           ? "text-rose-400"
           : "text-zinc-500";
     const urgColor =
       urgency === "high"
         ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
         : urgency === "medium"
           ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
           : "bg-zinc-800 text-zinc-500 border-zinc-700";

     function entityRows(entity: LogEntity) {
       return [
         entity.amount != null && { label: "Amount", value: `${entity.currency || ""} ${entity.amount}`.trim() },
         entity.date && { label: "Date", value: new Date(entity.date).toLocaleDateString() },
         entity.client && { label: "Client", value: entity.client },
         entity.project && { label: "Project", value: entity.project },
         entity.task && { label: "Task", value: entity.task },
         entity.status && { label: "Status", value: entity.status.replace("_", " ") },
         entity.sentiment && { label: "Sentiment", value: entity.sentiment },
         entity.urgency && { label: "Urgency", value: entity.urgency },
       ].filter(Boolean) as Array<{ label: string; value: string }>;
     }

     return (
       <motion.div
         initial={{ opacity: 0, y: 8 }}
         animate={{ opacity: 1, y: 0 }}
         className="rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
       >
         <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
           <div className="flex items-center gap-3">
             <div className="h-7 w-7 rounded-xl bg-zinc-800 flex items-center justify-center">
               {log.type === "file" ? (
                 <FileText size={13} className="text-zinc-400" />
               ) : (
                 <MessageSquare size={13} className="text-zinc-400" />
               )}
             </div>
             <span className="text-[11px] text-zinc-500">
               {new Date(log.timestamp).toLocaleString("en-US", {
                 weekday: "short",
                 month: "short",
                 day: "numeric",
                 hour: "2-digit",
                 minute: "2-digit",
               })}
             </span>
             {log.is_conflict ? (
               <span className="flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                 <AlertTriangle size={10} /> Conflict
               </span>
             ) : null}
           </div>
           <div className="flex items-center gap-2">
             {urgency && urgency !== "low" ? (
               <span className={`text-[9px] font-black uppercase rounded-full px-2 py-0.5 border ${urgColor}`}>
                 {urgency}
               </span>
             ) : null}
             {sentiment ? (
               <span className={`text-[10px] font-bold capitalize ${sentColor}`}>
                 {sentiment}
               </span>
             ) : null}
           </div>
         </div>

         <div className="px-5 py-4">
           <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
             {log.raw_content}
           </p>
           {log.file_url ? (
             <a
               href={log.file_url}
               target="_blank"
               rel="noopener noreferrer"
               className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
             >
               <FileText size={11} /> View file
             </a>
           ) : null}
         </div>

         {entities.length > 0 ? (
           <div className="space-y-2 px-5 pb-4">
             {entities.map(function (entity, i) {
               const rows = entityRows(entity);
               if (rows.length === 0) return null;
               return (
                 <div key={i} className="flex flex-wrap items-center gap-2">
                   {entities.length > 1 ? (
                     <span className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                       {entity.type.replace("_", " ")}
                     </span>
                   ) : null}
                   {rows.map(({ label, value }) => (
                     <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                       <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                         {label}:{" "}
                       </span>
                       <span className="text-[11px] font-semibold text-zinc-300 capitalize">
                         {value}
                       </span>
                     </div>
                   ))}
                 </div>
               );
             })}
           </div>
         ) : null}
       </motion.div>
     );
   }
   ```
3. In the page body, replace the stats/filter/aggregation entity reads:
   ```ts
   const filteredLogs = selectedSentiment
     ? logs.filter(function (l: Log) {
         return logSentiment(l) === selectedSentiment;
       })
     : logs;

   const amounts = logs.map(function (l: Log) { return logAmount(l); });
   const totalAmount = amounts.reduce(function (sum: number, a) { return sum + (a ? a.amount : 0); }, 0);
   const hasAmounts = amounts.some(Boolean);
   const currency = amounts.find(function (a) { return a && a.currency; })?.currency || "$";

   const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
   logs.forEach(function (l: Log) {
     const s = logSentiment(l);
     if (s && sentiments[s] !== undefined) sentiments[s]++;
   });
   ```
   Chart grouping:
   ```ts
   logs.forEach(function (l: Log) {
     const day = new Date(l.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
     if (!chartMap[day]) chartMap[day] = { date: day, value: 0, count: 0 };
     chartMap[day].count++;
     const a = logAmount(l);
     if (a) chartMap[day].value += a.amount;
   });
   ```
   Tags/people:
   ```ts
   const allTags = Array.from(new Set(
     logs.flatMap(function (l: Log) {
       return entitiesOf(l).flatMap(function (e) { return e.tags || []; });
     }),
   )).slice(0, 12) as string[];

   const allPeople = Array.from(new Set(
     logs.flatMap(function (l: Log) {
       return entitiesOf(l).flatMap(function (e) { return e.names || []; });
     }),
   )).slice(0, 10) as string[];
   ```
   Also change the `filteredLogs.map(function (log: any)` and `logs`/`allLogs` `any` types to `Log` where touched.

**`components/log-preview-modal.tsx`** — minimal interim change so arrays don't break it before the Task 13 rewrite. Change the import to `import { primaryEntity, type Log } from "@/lib/dashboard-utils";` and replace `const entities = log.entities || {};` with:

```ts
const entities = (primaryEntity(log) ?? {}) as {
  amount?: number | null; currency?: string | null; date?: string | null;
  sentiment?: string | null; urgency?: string | null; names?: string[]; tags?: string[];
};
```

**Verify:** `npx vitest run` green; `npx tsc --noEmit` clean.
**Commit:** `refactor(ui): read log entities through accessor layer`

---

## Task 5: Entity normalizer

**Write failing tests** — create `test/utils/entity-normalizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  NEEDS_REVIEW_THRESHOLD, normalizeEntities, overallConfidence, primaryCategory, statusFor,
} from '../../utils/api/entity-normalizer';

describe('normalizeEntities', () => {
  it('normalizes a valid entity array', () => {
    const result = normalizeEntities([
      {
        type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: 'yesterday',
        amount: '850', currency: 'ZAR', client: ' Acme ', project: null, task: null,
        status: null, issue_or_risk: null, deliverable: null,
        sentiment: 'neutral', urgency: 'low', confidence: 0.91,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: 'yesterday',
      amount: 850, currency: 'ZAR', client: 'Acme', sentiment: 'neutral', urgency: 'low', confidence: 0.91,
    });
  });

  it('coerces bad enums and clamps confidence', () => {
    const [e] = normalizeEntities([
      { type: 'banana', category: 'Bookkeeping', status: 'done', sentiment: 'meh', urgency: 'ASAP', confidence: 7 },
    ]);
    expect(e.type).toBe('note');
    expect(e.category).toBe('Other');
    expect(e.status).toBeNull();
    expect(e.sentiment).toBeNull();
    expect(e.urgency).toBeNull();
    expect(e.confidence).toBe(1);
  });

  it('nulls unusable amounts and dates', () => {
    const [e] = normalizeEntities([{ amount: 'lots', date: 'sometime', confidence: 0.9 }]);
    expect(e.amount).toBeNull();
    expect(e.date).toBeNull();
  });

  it('unwraps a { entities: [...] } wrapper object', () => {
    const result = normalizeEntities({ entities: [{ type: 'task', category: 'Tasks', confidence: 0.8 }] });
    expect(result[0].type).toBe('task');
  });

  it('falls back to a single low-confidence note for garbage', () => {
    for (const garbage of [null, 'text', 42, {}, []]) {
      const result = normalizeEntities(garbage);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('note');
      expect(result[0].category).toBe('Other');
      expect(result[0].confidence).toBeLessThan(NEEDS_REVIEW_THRESHOLD);
    }
  });

  it('caps entity count at 20', () => {
    const many = Array.from({ length: 30 }, () => ({ type: 'note', category: 'Other', confidence: 0.9 }));
    expect(normalizeEntities(many)).toHaveLength(20);
  });
});

describe('confidence helpers', () => {
  const entities = normalizeEntities([
    { type: 'expense', category: 'Finance', confidence: 0.95 },
    { type: 'task', category: 'Tasks', confidence: 0.7 },
  ]);

  it('overallConfidence is the minimum', () => {
    expect(overallConfidence(entities)).toBe(0.7);
  });

  it('primaryCategory follows the highest-confidence entity', () => {
    expect(primaryCategory(entities)).toBe('Finance');
    expect(primaryCategory([])).toBe('Other');
  });

  it('statusFor applies the 0.75 threshold', () => {
    expect(statusFor(0.74)).toBe('needs_review');
    expect(statusFor(0.75)).toBe('processed');
  });
});
```

Run — fails (module missing).

**Create `utils/api/entity-normalizer.ts`:**

```ts
import { CATEGORIES } from '@/lib/categories';
import { ENTITY_STATUSES, ENTITY_TYPES, type LogEntity } from '@/lib/dashboard-utils';

export const NEEDS_REVIEW_THRESHOLD = 0.75;
const FALLBACK_CONFIDENCE = 0.5;
const MAX_ENTITIES = 20;

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
const URGENCIES = ['low', 'medium', 'high'] as const;

function asEnum<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function asAmount(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

function asConfidence(value: unknown): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return FALLBACK_CONFIDENCE;
  return Math.min(1, Math.max(0, num));
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function asStringArray(value: unknown, max = 10): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 80))
    .slice(0, max);
  return items.length > 0 ? items : undefined;
}

export function fallbackEntity(): LogEntity {
  return {
    type: 'note',
    category: 'Other',
    date: null,
    date_reference: null,
    amount: null,
    currency: null,
    client: null,
    project: null,
    task: null,
    status: null,
    issue_or_risk: null,
    deliverable: null,
    sentiment: null,
    urgency: null,
    confidence: FALLBACK_CONFIDENCE,
  };
}

export function normalizeEntity(raw: unknown): LogEntity {
  const e = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    type: asEnum(e.type, ENTITY_TYPES) ?? 'note',
    category: asEnum(e.category, CATEGORIES) ?? 'Other',
    date: asIsoDate(e.date),
    date_reference: asString(e.date_reference, 120),
    amount: asAmount(e.amount),
    currency: asString(e.currency, 8),
    client: asString(e.client, 120),
    project: asString(e.project, 120),
    task: asString(e.task, 300),
    status: asEnum(e.status, ENTITY_STATUSES),
    issue_or_risk: asString(e.issue_or_risk, 300),
    deliverable: asString(e.deliverable, 300),
    sentiment: asEnum(e.sentiment, SENTIMENTS),
    urgency: asEnum(e.urgency, URGENCIES),
    confidence: asConfidence(e.confidence),
    names: asStringArray(e.names),
    tags: asStringArray(e.tags),
  };
}

/**
 * Defensive normalization of LLM output before any DB write.
 * Accepts a bare array or a { entities: [...] } wrapper; anything else
 * (or an empty list) becomes a single low-confidence note so the log
 * is preserved and flagged for review.
 */
export function normalizeEntities(raw: unknown): LogEntity[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { entities?: unknown }).entities)
      ? ((raw as { entities: unknown[] }).entities)
      : null;
  if (!list || list.length === 0) return [fallbackEntity()];
  return list.slice(0, MAX_ENTITIES).map(normalizeEntity);
}

/** A chain is as trustworthy as its weakest extraction. */
export function overallConfidence(entities: LogEntity[]): number {
  return entities.reduce((min, e) => Math.min(min, e.confidence), 1);
}

export function primaryCategory(entities: LogEntity[]): string {
  if (entities.length === 0) return 'Other';
  return entities.reduce((best, e) => (e.confidence > best.confidence ? e : best)).category;
}

export function statusFor(confidence: number): 'processed' | 'needs_review' {
  return confidence < NEEDS_REVIEW_THRESHOLD ? 'needs_review' : 'processed';
}
```

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(extraction): defensive entity normalizer with confidence helpers`

---

## Task 6: Deterministic date-reference resolver

**Write failing tests** — create `test/utils/date-reference.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveDateReference } from '../../utils/api/date-reference';

// 2026-07-12 is a Sunday. 22:30 UTC = 00:30 Jul 13 in Africa/Johannesburg (UTC+2).
const SUNDAY_EVENING_UTC = new Date('2026-07-12T22:30:00Z');

describe('resolveDateReference', () => {
  it('resolves today/yesterday/tomorrow in the user timezone', () => {
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
    expect(resolveDateReference('yesterday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-11');
    expect(resolveDateReference('tomorrow', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-13');
  });

  it('crosses midnight correctly for non-UTC timezones', () => {
    // Already Monday Jul 13 in Johannesburg
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'Africa/Johannesburg')).toBe('2026-07-13');
    expect(resolveDateReference('yesterday', SUNDAY_EVENING_UTC, 'Africa/Johannesburg')).toBe('2026-07-12');
  });

  it('treats tonight and this morning/afternoon/evening as today', () => {
    for (const ref of ['tonight', 'this morning', 'this afternoon', 'this evening']) {
      expect(resolveDateReference(ref, SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
    }
  });

  it('resolves "last <weekday>", going a full week back on the same weekday', () => {
    // Jul 12 2026 is a Sunday
    expect(resolveDateReference('last Friday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-10');
    expect(resolveDateReference('last Sunday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
    // On a Friday, "last Friday" means 7 days ago
    const friday = new Date('2026-07-10T12:00:00Z');
    expect(resolveDateReference('last friday', friday, 'UTC')).toBe('2026-07-03');
  });

  it('resolves "next <weekday>" and a bare weekday (most recent occurrence)', () => {
    expect(resolveDateReference('next Tuesday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-14');
    expect(resolveDateReference('on friday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-10');
    expect(resolveDateReference('Sunday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
  });

  it('resolves relative day counts and last week', () => {
    expect(resolveDateReference('3 days ago', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-09');
    expect(resolveDateReference('last week', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
    expect(resolveDateReference('a week ago', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
  });

  it('returns null for unparseable or missing references', () => {
    expect(resolveDateReference('when the invoice cleared', SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
    expect(resolveDateReference(null, SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
    expect(resolveDateReference('', SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
  });

  it('returns null instead of throwing for a bad timezone', () => {
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'Not/AZone')).toBeNull();
  });
});
```

Run — fails.

**Create `utils/api/date-reference.ts`:**

```ts
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PATTERN = WEEKDAYS.join('|');

type Ymd = { y: number; m: number; d: number };

function partsInTz(date: Date, timeZone: string): { ymd: Ymd; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    ymd: { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')) },
    weekday: WEEKDAY_SHORT.indexOf(get('weekday')),
  };
}

function shift(ymd: Ymd, days: number): Ymd {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function format(ymd: Ymd): string {
  return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
}

/**
 * Deterministically resolves a natural-language date reference relative to
 * the submission moment in the user's timezone. Returns 'YYYY-MM-DD', or
 * null when the reference doesn't parse (caller keeps the LLM's guess).
 */
export function resolveDateReference(
  reference: string | null | undefined,
  submittedAt: Date,
  timeZone: string,
): string | null {
  if (!reference || typeof reference !== 'string') return null;
  const ref = reference.trim().toLowerCase();
  if (!ref) return null;

  let today: Ymd;
  let weekday: number;
  try {
    ({ ymd: today, weekday } = partsInTz(submittedAt, timeZone));
  } catch {
    return null;
  }
  if (weekday === -1 || !Number.isFinite(today.y)) return null;

  if (/^(today|tonight|this (morning|afternoon|evening))$/.test(ref)) return format(today);
  if (ref === 'yesterday') return format(shift(today, -1));
  if (ref === 'tomorrow') return format(shift(today, 1));
  if (ref === 'last week' || ref === 'a week ago' || ref === 'one week ago') return format(shift(today, -7));

  const daysAgo = ref.match(/^(\d{1,2}) days? ago$/);
  if (daysAgo) return format(shift(today, -Number(daysAgo[1])));

  const last = ref.match(new RegExp(`^last (${WEEKDAY_PATTERN})$`));
  if (last) {
    const target = WEEKDAYS.indexOf(last[1]);
    let diff = weekday - target;
    if (diff <= 0) diff += 7;
    return format(shift(today, -diff));
  }

  const next = ref.match(new RegExp(`^next (${WEEKDAY_PATTERN})$`));
  if (next) {
    const target = WEEKDAYS.indexOf(next[1]);
    let diff = target - weekday;
    if (diff <= 0) diff += 7;
    return format(shift(today, diff));
  }

  const bare = ref.match(new RegExp(`^(?:on )?(${WEEKDAY_PATTERN})$`));
  if (bare) {
    const target = WEEKDAYS.indexOf(bare[1]);
    let diff = weekday - target;
    if (diff < 0) diff += 7;
    return format(shift(today, -diff));
  }

  return null;
}
```

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(extraction): deterministic timezone-aware date-reference resolver`

---

## Task 7: Correction merge with audit trail

**Write failing tests** — create `test/utils/corrections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCorrections, CORRECTABLE_FIELDS } from '../../utils/api/corrections';
import type { LogEntity } from '../../lib/dashboard-utils';

const AT = '2026-07-12T10:00:00.000Z';
const LATER = '2026-07-12T11:00:00.000Z';

function entity(overrides: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: null,
    amount: 850, currency: 'ZAR', client: 'Acme', project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null,
    sentiment: null, urgency: null, confidence: 0.9,
    ...overrides,
  };
}

describe('CORRECTABLE_FIELDS', () => {
  it('matches PRD Req 19', () => {
    expect(CORRECTABLE_FIELDS).toEqual(['category', 'type', 'status', 'amount', 'date', 'client', 'project', 'task']);
  });
});

describe('applyCorrections', () => {
  it('applies changes and records a per-field audit entry', () => {
    const result = applyCorrections([entity()], 0, { category: 'Operations', amount: 900 }, AT);
    expect(result[0].category).toBe('Operations');
    expect(result[0].amount).toBe(900);
    expect(result[0].corrections).toEqual({
      category: { from: 'Finance', to: 'Operations', at: AT },
      amount: { from: 850, to: 900, at: AT },
    });
  });

  it('does not mutate the input and leaves other entities untouched', () => {
    const original = [entity(), entity({ category: 'Tasks' })];
    const result = applyCorrections(original, 0, { client: 'Zenith' }, AT);
    expect(original[0].client).toBe('Acme');
    expect(original[0].corrections).toBeUndefined();
    expect(result[1]).toBe(original[1]);
  });

  it('preserves the original `from` across repeated corrections', () => {
    const once = applyCorrections([entity()], 0, { amount: 900 }, AT);
    const twice = applyCorrections(once, 0, { amount: 950 }, LATER);
    expect(twice[0].corrections?.amount).toEqual({ from: 850, to: 950, at: LATER });
  });

  it('skips no-op changes without writing an audit entry', () => {
    const result = applyCorrections([entity()], 0, { client: 'Acme' }, AT);
    expect(result[0].corrections).toBeUndefined();
  });

  it('accepts null to clear nullable fields, and normalizes empty strings to null', () => {
    const result = applyCorrections([entity()], 0, { client: '', status: null }, AT);
    expect(result[0].client).toBeNull();
    expect(result[0].corrections?.client).toEqual({ from: 'Acme', to: null, at: AT });
    expect(result[0].corrections?.status).toBeUndefined(); // was already null: no-op
  });

  it('rejects invalid indexes, fields, and values', () => {
    expect(() => applyCorrections([entity()], 1, { amount: 900 }, AT)).toThrow(/entity index/i);
    expect(() => applyCorrections([entity()], -1, { amount: 900 }, AT)).toThrow(/entity index/i);
    expect(() => applyCorrections([entity()], 0, { confidence: 1 }, AT)).toThrow(/not correctable/i);
    expect(() => applyCorrections([entity()], 0, { category: 'Bogus' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { type: 'banana' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { amount: 'lots' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { date: 'sometime' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { category: null }, AT)).toThrow(/invalid/i);
  });
});
```

Run — fails.

**Create `utils/api/corrections.ts`:**

```ts
import { CATEGORIES } from '@/lib/categories';
import { ENTITY_STATUSES, ENTITY_TYPES, type LogEntity } from '@/lib/dashboard-utils';

export const CORRECTABLE_FIELDS = [
  'category', 'type', 'status', 'amount', 'date', 'client', 'project', 'task',
] as const;
export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

function invalid(field: string): never {
  throw new Error(`Invalid value for "${field}"`);
}

function validateValue(field: CorrectableField, value: unknown): LogEntity[CorrectableField] {
  switch (field) {
    case 'category':
      if (typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)) return value;
      invalid(field);
    case 'type':
      if (typeof value === 'string' && (ENTITY_TYPES as readonly string[]).includes(value)) return value as LogEntity['type'];
      invalid(field);
    case 'status':
      if (value === null || value === '') return null;
      if (typeof value === 'string' && (ENTITY_STATUSES as readonly string[]).includes(value)) return value as LogEntity['status'];
      invalid(field);
    case 'amount': {
      if (value === null || value === '') return null;
      const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (Number.isFinite(num)) return num;
      invalid(field);
    }
    case 'date':
      if (value === null || value === '') return null;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      invalid(field);
    case 'client':
    case 'project':
    case 'task': {
      if (value === null) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim().slice(0, 200);
        return trimmed || null;
      }
      invalid(field);
    }
  }
  invalid(field); // unreachable; satisfies TS return-path analysis
}

/**
 * Immutably applies user corrections to one entity, recording a per-field
 * audit entry. `from` always keeps the ORIGINAL AI value, even across
 * repeated corrections of the same field.
 */
export function applyCorrections(
  entities: LogEntity[],
  entityIndex: number,
  changes: Record<string, unknown>,
  at: string,
): LogEntity[] {
  if (!Number.isInteger(entityIndex) || entityIndex < 0 || entityIndex >= entities.length) {
    throw new Error('Invalid entity index');
  }
  return entities.map((entity, i) => {
    if (i !== entityIndex) return entity;
    const next: LogEntity = { ...entity, corrections: { ...(entity.corrections ?? {}) } };
    for (const [field, rawValue] of Object.entries(changes)) {
      if (!(CORRECTABLE_FIELDS as readonly string[]).includes(field)) {
        throw new Error(`Field "${field}" is not correctable`);
      }
      const value = validateValue(field as CorrectableField, rawValue);
      const current = (entity[field as CorrectableField] ?? null) as unknown;
      if (current === value) continue;
      // `in` check (not ??) so an original null value survives repeated corrections
      const priorAudit = entity.corrections && field in entity.corrections ? entity.corrections[field] : null;
      const original = priorAudit ? priorAudit.from : current;
      (next as Record<string, unknown>)[field] = value;
      next.corrections![field] = { from: original, to: value, at };
    }
    if (Object.keys(next.corrections!).length === 0) delete next.corrections;
    return next;
  });
}
```

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(trust): correction merge with immutable per-field audit trail`

---

## Task 8: Tiered Groq model routing

**Write failing tests** — create `test/utils/groq.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickExtractionModel } from '../../utils/api/groq';

describe('pickExtractionModel', () => {
  it('routes short text logs to the 8B instant model', () => {
    expect(pickExtractionModel('Paid R850 for fuel', 'text')).toBe('llama-3.1-8b-instant');
  });

  it('routes long text to the 70B model', () => {
    expect(pickExtractionModel('x'.repeat(300), 'text')).toBe('llama-3.3-70b-versatile');
  });

  it('always routes file logs to the 70B model', () => {
    expect(pickExtractionModel('short', 'file')).toBe('llama-3.3-70b-versatile');
  });
});
```

Run — fails.

**Update `utils/api/groq.ts`:**

```ts
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export type GroqModel = 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile';

const SHORT_TEXT_LIMIT = 300;

/**
 * Tiered routing: short plain-text logs go to the fast 8B model, anything
 * complex (long text, file content) to the 70B. Deliberately no reasoning
 * model — latency works against the 2s budget (see spec).
 */
export function pickExtractionModel(rawContent: string, type: 'text' | 'file'): GroqModel {
  return type === 'text' && rawContent.length < SHORT_TEXT_LIMIT
    ? 'llama-3.1-8b-instant'
    : 'llama-3.3-70b-versatile';
}

export async function callGroq(messages: Message[], model: GroqModel = 'llama-3.3-70b-versatile') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('AI provider is not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) throw new Error(`AI provider request failed with status ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI provider returned an invalid response');
  return content;
}

export function extractJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    const last = cleaned.lastIndexOf('```');
    if (last !== -1) cleaned = cleaned.slice(0, last).trim();
  }
  return JSON.parse(cleaned);
}
```

(All existing `callGroq(messages)` call sites keep working via the default.)

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(ai): tiered Groq model routing for extraction`

---

## Task 9: Payload validation (retry + corrections)

**Write failing tests** — create `test/utils/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCorrectionPayload, parseProcessPayload } from '../../utils/api/validation';

const UUID = '2f5a1f64-9a3b-4c1d-8e2f-0a1b2c3d4e5f';

describe('parseProcessPayload', () => {
  it('keeps existing behavior for fresh submissions', () => {
    expect(parseProcessPayload({ rawContent: ' hi ', type: 'file', fileUrl: 'https://x.test/f' }))
      .toEqual({ rawContent: 'hi', type: 'file', fileUrl: 'https://x.test/f', logId: null });
    expect(() => parseProcessPayload({})).toThrow(/required/i);
    expect(() => parseProcessPayload({ rawContent: 'x'.repeat(12001) })).toThrow(/too long/i);
  });

  it('accepts a retry payload with only a logId', () => {
    expect(parseProcessPayload({ logId: UUID })).toEqual({ rawContent: '', type: 'text', fileUrl: null, logId: UUID });
  });

  it('rejects malformed logIds', () => {
    expect(() => parseProcessPayload({ logId: 'not-a-uuid' })).toThrow(/required/i);
    expect(parseProcessPayload({ logId: 'not-a-uuid', rawContent: 'hi' }).logId).toBeNull();
  });
});

describe('parseCorrectionPayload', () => {
  it('parses corrections with an entity index', () => {
    expect(parseCorrectionPayload({ entityIndex: 0, corrections: { amount: 900, client: 'Acme', status: null } }))
      .toEqual({ entityIndex: 0, corrections: { amount: 900, client: 'Acme', status: null }, excludedFromReports: null });
  });

  it('parses an exclusion-only payload', () => {
    expect(parseCorrectionPayload({ excludedFromReports: true }))
      .toEqual({ entityIndex: null, corrections: null, excludedFromReports: true });
  });

  it('drops non-primitive correction values and oversized strings', () => {
    const parsed = parseCorrectionPayload({
      entityIndex: 1,
      corrections: { client: { nested: true }, task: 'ok', date: 'x'.repeat(400) },
    });
    expect(parsed.corrections).toEqual({ task: 'ok' });
  });

  it('rejects corrections without an index, and empty payloads', () => {
    expect(() => parseCorrectionPayload({ corrections: { amount: 1 } })).toThrow(/entityIndex/i);
    expect(() => parseCorrectionPayload({})).toThrow(/nothing to update/i);
    expect(() => parseCorrectionPayload({ entityIndex: 0, corrections: {} })).toThrow(/nothing to update/i);
  });
});
```

Run — fails.

**Update `utils/api/validation.ts`** — replace `parseProcessPayload` and add `parseCorrectionPayload`:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseProcessPayload(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawContent = typeof body.rawContent === 'string' ? body.rawContent.trim() : '';
  // A retry payload carries only the logId; the server re-reads stored content.
  const logId = !rawContent && typeof body.logId === 'string' && UUID_RE.test(body.logId) ? body.logId : null;
  if (!rawContent && !logId) throw new Error('Log content is required');
  if (rawContent.length > 12000) throw new Error('Log content is too long');

  const type = body.type === 'file' ? 'file' : 'text';
  const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.startsWith('https://')
    ? body.fileUrl
    : null;

  return { rawContent, type, fileUrl, logId };
}

export function parseCorrectionPayload(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};

  const entityIndex = typeof body.entityIndex === 'number' && Number.isInteger(body.entityIndex)
    && body.entityIndex >= 0 && body.entityIndex < 50
    ? body.entityIndex
    : null;

  let corrections: Record<string, string | number | null> | null = null;
  if (body.corrections && typeof body.corrections === 'object' && !Array.isArray(body.corrections)) {
    corrections = {};
    for (const [key, value] of Object.entries(body.corrections as Record<string, unknown>)) {
      if (key.length > 40) continue;
      if (value === null || typeof value === 'number' || (typeof value === 'string' && value.length <= 300)) {
        corrections[key] = value;
      }
    }
    if (Object.keys(corrections).length === 0) corrections = null;
  }

  const excludedFromReports = typeof body.excludedFromReports === 'boolean' ? body.excludedFromReports : null;

  if (corrections && entityIndex === null) throw new Error('entityIndex is required with corrections');
  if (!corrections && excludedFromReports === null) throw new Error('Nothing to update');

  return { entityIndex, corrections, excludedFromReports };
}
```

(Field-name whitelisting happens in `applyCorrections`, which throws → 400.)

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(api): retry and correction payload validation`

---

## Task 10: Rewrite `POST /api/process`

No new unit tests — all logic lives in the modules tested in Tasks 5–9; the route is thin orchestration verified end-to-end in Task 15.

**Replace `app/api/process/route.ts` entirely:**

```ts
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson, pickExtractionModel } from '@/utils/api/groq';
import { DEFAULT_SETTINGS, parseProcessPayload } from '@/utils/api/validation';
import { normalizeEntities, overallConfidence, primaryCategory, statusFor } from '@/utils/api/entity-normalizer';
import { resolveDateReference } from '@/utils/api/date-reference';
import { CATEGORIES } from '@/lib/categories';
import { entitiesOf, ENTITY_TYPES, type Log, type LogEntity } from '@/lib/dashboard-utils';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`process:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const parsed = parseProcessPayload(await request.json());
    const userId = user.id;

    // Retry path: reuse the stored raw content and update the same row.
    let { rawContent, type, fileUrl } = parsed;
    let retryLogId: string | null = null;
    if (parsed.logId) {
      const { data: row, error: fetchError } = await admin
        .from('logs')
        .select('id, raw_content, type, file_url')
        .eq('id', parsed.logId)
        .eq('user_id', userId)
        .single();
      if (fetchError || !row) {
        return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      }
      retryLogId = row.id;
      rawContent = row.raw_content;
      type = row.type === 'file' ? 'file' : 'text';
      fileUrl = row.file_url;
    }

    // Settings live in auth user_metadata; the user_settings table has no grants.
    const stored = user.user_metadata?.settings;
    const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
    const { currency, timezone, ai_language: aiLanguage } = settings;
    const conflictDetection = settings.conflict_detection !== false;
    const conflictDismissDays = settings.conflict_dismiss_days ?? 7;

    // Known clients: flatten entity arrays in JS (entities->client stopped
    // working when entities became an array).
    const { data: clientRows } = await admin
      .from('logs')
      .select('category, entities')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    const knownClients: string[] = [];
    for (const row of clientRows ?? []) {
      for (const entity of entitiesOf(row as Log)) {
        const client = typeof entity.client === 'string' ? entity.client.trim() : '';
        if (client && !knownClients.includes(client)) knownClients.push(client);
      }
    }

    const submittedAt = new Date();
    const systemPrompt = [
      'You are an AI data extractor for Codex, a reporting platform for consultants and agencies.',
      'Extract EVERY distinct piece of information from the log entry as separate entity objects. A single entry may contain several updates (an expense AND a task AND a client update) — split them into separate entities.',
      'Return ONLY a valid JSON array with no markdown, no code blocks, and no explanation. Even a single entity must be wrapped in an array.',
      'Each array element must have exactly this shape:',
      `{ "type": "${ENTITY_TYPES.join('|')}",`,
      `  "category": "${CATEGORIES.join('|')}",`,
      '  "date": "YYYY-MM-DD best guess, or null",',
      '  "date_reference": "the verbatim date phrase from the text (e.g. \\"yesterday\\", \\"last Friday\\"), or null",',
      '  "amount": number or null, "currency": "ISO currency code or null",',
      '  "client": "string or null", "project": "string or null",',
      '  "task": "string or null", "status": "open|in_progress|complete|blocked or null",',
      '  "issue_or_risk": "string or null", "deliverable": "string or null",',
      '  "sentiment": "positive|neutral|negative or null", "urgency": "low|medium|high or null",',
      '  "confidence": number between 0 and 1 — how certain you are about THIS entity }',
      `Today's date for resolving relative dates: ${submittedAt.toLocaleString('en-US', { timeZone: timezone })} (timezone: ${timezone})`,
      `Default currency: ${currency}. Use this when no currency is specified.`,
      `Write any free-text fields in ${aiLanguage}.`,
      knownClients.length
        ? `Known clients: ${knownClients.join(', ')}. If the entry refers to one of these (even loosely, e.g. an abbreviation), use the EXACT known spelling. Only introduce a new client name if it clearly is not one of the known clients.`
        : 'If the entry names a client/customer the work is for, extract that name; otherwise use null.',
    ].join('\n');

    let entities: LogEntity[] | null = null;
    try {
      const model = pickExtractionModel(rawContent, type as 'text' | 'file');
      const aiResponse = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawContent },
      ], model);
      entities = normalizeEntities(extractJson(aiResponse));
    } catch (extractionError) {
      console.error('api/process extraction failed:', extractionError);
    }

    // Failure path: save the log anyway so nothing is lost; the feed offers a retry.
    if (!entities) {
      const failedFields = {
        category: 'Other',
        entities: [] as LogEntity[],
        ai_confidence: null,
        processing_status: 'failed',
        is_conflict: false,
        conflict_source_id: null,
        conflict_reason: null,
      };
      const { data: savedLog, error: saveError } = retryLogId
        ? await admin.from('logs').update(failedFields).eq('id', retryLogId).eq('user_id', userId).select().single()
        : await admin.from('logs').insert({
            user_id: userId,
            raw_content: rawContent,
            type,
            file_url: fileUrl ?? null,
            ...failedFields,
          }).select().single();
      if (saveError) throw saveError;
      return NextResponse.json({ success: true, extractionFailed: true, log: savedLog });
    }

    // Deterministic date resolution overrides the model's guess when the reference parses.
    entities = entities.map((entity) => {
      const resolved = resolveDateReference(entity.date_reference, submittedAt, timezone);
      return resolved ? { ...entity, date: resolved } : entity;
    });

    const aiConfidence = overallConfidence(entities);
    const category = primaryCategory(entities);
    const processingStatus = statusFor(aiConfidence);

    // Conflict detection: unchanged, keyed off the primary category.
    const windowStart = new Date(Date.now() - conflictDismissDays * 86400000).toISOString();
    let recentLogs: Array<{ id: string; raw_content: string }> | null = null;
    if (conflictDetection) {
      let recentQuery = admin
        .from('logs')
        .select('id, raw_content')
        .eq('user_id', userId)
        .eq('category', category)
        .gte('timestamp', windowStart)
        .order('timestamp', { ascending: false })
        .limit(5);
      if (retryLogId) recentQuery = recentQuery.neq('id', retryLogId);
      ({ data: recentLogs } = await recentQuery);
    }

    let isConflict = false;
    let conflictSourceId: string | null = null;
    let conflictReason: string | null = null;

    if (conflictDetection && recentLogs && recentLogs.length > 0) {
      const comparisons = recentLogs.map((l, i) => `[${i + 1}] ${l.raw_content}`).join('\n\n');
      const similarityPrompt = `You are a duplicate-detection assistant. Compare the NEW entry against each EXISTING entry and return ONLY valid JSON.

NEW ENTRY:
${rawContent}

EXISTING ENTRIES TODAY (same category):
${comparisons}

Rules:
- "duplicate": true only if the new entry conveys identical or near-identical information as an existing entry (more similarities than differences in actual content, facts, or figures).
- "duplicate": false if the entries are merely in the same category but describe different events, amounts, people, or dates.
- If duplicate, set "source_index" to the 1-based index of the most similar existing entry, and "reason" to a one-sentence plain-English explanation of why they are duplicates.

Return: { "duplicate": boolean, "source_index": number | null, "reason": string | null }`;

      try {
        const similarityResult = await callGroq([{ role: 'user', content: similarityPrompt }]);
        const similarity = extractJson(similarityResult);
        if (
          similarity.duplicate &&
          Number.isInteger(similarity.source_index) &&
          similarity.source_index >= 1 &&
          similarity.source_index <= recentLogs.length
        ) {
          isConflict = true;
          conflictSourceId = recentLogs[similarity.source_index - 1].id;
          conflictReason = typeof similarity.reason === 'string' ? similarity.reason.slice(0, 500) : null;
        }
      } catch (conflictError) {
        // Extraction succeeded — a conflict-check failure must not fail the log.
        console.error('api/process conflict check failed:', conflictError);
      }
    }

    const logFields = {
      category,
      entities,
      ai_confidence: aiConfidence,
      processing_status: processingStatus,
      is_conflict: isConflict,
      conflict_source_id: conflictSourceId,
      conflict_reason: conflictReason,
    };
    const { data: savedLog, error: insertError } = retryLogId
      ? await admin.from('logs').update(logFields).eq('id', retryLogId).eq('user_id', userId).select().single()
      : await admin.from('logs').insert({
          user_id: userId,
          raw_content: rawContent,
          type,
          file_url: fileUrl ?? null,
          ...logFields,
        }).select().single();

    if (insertError) throw insertError;

    // Ensure a widget exists for the primary category.
    const { data: existingWidgets } = await admin
      .from('widgets')
      .select('id')
      .eq('user_id', userId)
      .contains('config', { category });

    if (!existingWidgets?.length) {
      let widgetType = 'metric';
      if (category === 'Finance') widgetType = 'chart';
      if (category === 'Tasks') widgetType = 'list';

      await admin.from('widgets').insert({
        user_id: userId,
        type: widgetType,
        title: category,
        config: { category, w: 4, h: 2, x: 0, y: 0 },
      });
    }

    return NextResponse.json({ success: true, log: savedLog });
  } catch (error) {
    console.error('api/process error:', error);
    if (error instanceof Error && /required|too long/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
```

Notes on deliberate changes vs. the old route:
- `user_settings` table read → `user.user_metadata.settings` (the table read always failed silently: 42501).
- The categories upsert / `is_proposed` block is **removed** — the normalizer coerces to the fixed PRD set; the proposed-new-category flow is deferred to sub-project 2 (spec, out-of-scope).
- Groq/JSON failures no longer 500: the log is saved as `failed` and `{ extractionFailed: true }` is returned.

**Verify:** `npx vitest run` green; `npx tsc --noEmit` clean.
**Commit:** `feat(extraction): multi-entity pipeline with confidence, date resolution, and failure retry`

---

## Task 11: `PATCH /api/logs/[id]` + reports route fix

**`app/api/logs/[id]/route.ts`** — add imports and the PATCH handler (DELETE stays untouched):

```ts
import { parseCorrectionPayload } from '@/utils/api/validation';
import { applyCorrections } from '@/utils/api/corrections';
import { primaryCategory } from '@/utils/api/entity-normalizer';
import { entitiesOf, type Log } from '@/lib/dashboard-utils';
```

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`correct-log:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });

    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityIndex, corrections, excludedFromReports } = parseCorrectionPayload(await request.json());

    const admin = createAdminClient();
    const { data: log, error: fetchError } = await admin
      .from('logs')
      .select('id, category, entities, processing_status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (corrections && entityIndex !== null) {
      const entities = applyCorrections(entitiesOf(log as Log), entityIndex, corrections, new Date().toISOString());
      updates.entities = entities;
      updates.category = primaryCategory(entities);
      // Corrections resolve the review prompt; ai_confidence stays untouched —
      // it describes the AI's output, not the corrected data.
      if (log.processing_status === 'needs_review') updates.processing_status = 'processed';
    }
    if (excludedFromReports !== null) updates.excluded_from_reports = excludedFromReports;

    const { data: savedLog, error: updateError } = await admin
      .from('logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ success: true, log: savedLog });
  } catch (error) {
    if (error instanceof Error && /invalid|not correctable|nothing to update|entityindex/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
```

**`app/api/reports/route.ts`** — two changes in the POST query (lines 27–34):

```ts
    let query = admin
      .from('logs')
      .select('raw_content, category, entities, timestamp')
      .eq('user_id', user.id)
      .eq('excluded_from_reports', false)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (client) query = query.contains('entities', [{ client }]);
```

(`entities->>client` cannot match array elements; `@>` containment via `.contains` does, and the migration's GIN index serves it. Requires the migration to have wrapped all rows.)

**Verify:** `npx vitest run` green; `npx tsc --noEmit` clean.
**Commit:** `feat(trust): correction endpoint with audit trail; reports respect exclusion and entity arrays`

---

## Task 12: Feed status chips + retry wiring

**Write failing test** — create `test/components/log-feed-item.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogFeedItem } from '../../components/log-feed-item';
import type { Log } from '../../lib/dashboard-utils';

function log(overrides: Partial<Log>): Log {
  return {
    id: 'log-1',
    user_id: 'u',
    raw_content: 'Paid R850 for fuel',
    type: 'text',
    category: 'Finance',
    is_conflict: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('LogFeedItem status chips', () => {
  it('shows no status chip for processed logs', () => {
    render(<LogFeedItem log={log({ processing_status: 'processed' })} onClick={() => {}} />);
    expect(screen.queryByText(/review/i)).toBeNull();
    expect(screen.queryByText(/retry/i)).toBeNull();
  });

  it('shows a review chip for needs_review logs', () => {
    render(<LogFeedItem log={log({ processing_status: 'needs_review' })} onClick={() => {}} />);
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });

  it('shows a retry chip for failed logs that calls onRetry without opening the log', () => {
    const onClick = vi.fn();
    const onRetry = vi.fn();
    render(<LogFeedItem log={log({ processing_status: 'failed' })} onClick={onClick} onRetry={onRetry} />);
    fireEvent.click(screen.getByText(/retry/i));
    expect(onRetry).toHaveBeenCalledWith('log-1');
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

Run — fails.

**Update `components/log-feed-item.tsx`** (on top of Task 4's version): change the signature and header row.

Signature:

```tsx
import { FileText, AlertTriangle, ChevronRight, RotateCcw, Eye } from "lucide-react";
// …
export function LogFeedItem({ log, onClick, onRetry }: {
  log: Log;
  onClick: () => void;
  onRetry?: (logId: string) => void;
}) {
  // …existing accessor consts from Task 4…
  const status = log.processing_status ?? "processed";
```

In the header row, after the `is_conflict` icon, add:

```tsx
          {status === "needs_review" ? (
            <span className="flex items-center gap-1 rounded-full border border-dashed border-zinc-600 px-2 py-px text-[10px] font-medium text-zinc-400">
              <Eye size={9} /> review
            </span>
          ) : null}
          {status === "failed" ? (
            <span
              role="button"
              tabIndex={0}
              onClick={function (e) {
                e.stopPropagation();
                onRetry?.(log.id);
              }}
              onKeyDown={function (e) {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onRetry?.(log.id);
                }
              }}
              className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-px text-[10px] font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
            >
              <RotateCcw size={9} /> Failed · retry
            </span>
          ) : null}
```

(`span role="button"` because the whole card is already a `<button>` — nested buttons are invalid HTML.)

**Wire retry in `app/page.tsx`** — add after `processMutation`:

```ts
  const retryMutation = useMutation({
    mutationFn: async function (logId: string) {
      const res = await csrfFetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      return data;
    },
    onSuccess: function (data: { extractionFailed?: boolean }) {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      if (data.extractionFailed) {
        toast.error("Extraction failed again — the log is saved, retry anytime");
      } else {
        toast.success("Log processed");
      }
    },
    onError: function (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    },
  });
```

Update `processMutation.onSuccess` to surface the failure path:

```ts
    onSuccess: function (data: { extractionFailed?: boolean }) {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (data && data.extractionFailed) {
        toast.error("Saved, but extraction failed — retry from the feed");
      }
    },
```

And the `<LogFeedItem>` call site:

```tsx
                      <LogFeedItem
                        key={log.id}
                        log={log}
                        onClick={function () {
                          setPreviewLog(log);
                        }}
                        onRetry={function (logId) {
                          retryMutation.mutate(logId);
                        }}
                      />
```

**Verify:** `npx vitest run` — all green.
**Commit:** `feat(trust): review and failed-retry status chips in the log feed`

---

## Task 13: Original Log Modal (confidence, corrections, exclusion)

**Write failing test** — create `test/components/entity-correction-card.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { changesFromDraft, draftFromEntity, EntityCorrectionCard } from '../../components/entity-correction-card';
import type { LogEntity } from '../../lib/dashboard-utils';

function entity(overrides: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: null,
    amount: 850, currency: 'ZAR', client: 'Acme', project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null,
    sentiment: null, urgency: null, confidence: 0.9,
    ...overrides,
  };
}

describe('draft round-trip', () => {
  it('an unedited draft produces no changes', () => {
    const e = entity();
    expect(changesFromDraft(e, draftFromEntity(e))).toEqual({});
  });

  it('diffs edited fields with correct value types', () => {
    const e = entity();
    const draft = { ...draftFromEntity(e), amount: '900', client: '', status: 'complete' };
    expect(changesFromDraft(e, draft)).toEqual({ amount: 900, client: null, status: 'complete' });
  });
});

describe('EntityCorrectionCard', () => {
  it('renders entity values and a corrected marker with the original value', () => {
    const e = entity({ corrections: { amount: { from: 850, to: 900, at: '2026-07-12T10:00:00Z' } }, amount: 900 });
    render(<EntityCorrectionCard entity={e} index={0} saving={false} onSave={vi.fn()} />);
    expect(screen.getByText(/900/)).toBeInTheDocument();
    expect(screen.getByText(/was 850/i)).toBeInTheDocument();
  });

  it('saves only the diff when edited', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EntityCorrectionCard entity={entity()} index={2} saving={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(2, { amount: 900 });
  });
});
```

Run — fails.

**Create `components/entity-correction-card.tsx`:**

```tsx
'use client';

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Input, Label,
} from "@/utils/client-integrations/shadcn-ui";
import { CATEGORIES, getCat } from "@/lib/categories";
import { ENTITY_STATUSES, ENTITY_TYPES, type LogEntity } from "@/lib/dashboard-utils";

const NONE = "__none__";

export type EntityDraft = {
  category: string;
  type: string;
  status: string;
  amount: string;
  date: string;
  client: string;
  project: string;
  task: string;
};

export function draftFromEntity(entity: LogEntity): EntityDraft {
  return {
    category: entity.category,
    type: entity.type,
    status: entity.status ?? "",
    amount: entity.amount != null ? String(entity.amount) : "",
    date: entity.date ? entity.date.slice(0, 10) : "",
    client: entity.client ?? "",
    project: entity.project ?? "",
    task: entity.task ?? "",
  };
}

/** Diff a draft against its entity; only edited fields become corrections. */
export function changesFromDraft(entity: LogEntity, draft: EntityDraft): Record<string, string | number | null> {
  const changes: Record<string, string | number | null> = {};
  if (draft.category !== entity.category) changes.category = draft.category;
  if (draft.type !== entity.type) changes.type = draft.type;
  if (draft.status !== (entity.status ?? "")) changes.status = draft.status || null;
  const draftAmount = draft.amount.trim() === "" ? null : Number(draft.amount);
  if (draftAmount !== (entity.amount ?? null) && !(draftAmount !== null && Number.isNaN(draftAmount))) {
    changes.amount = draftAmount;
  }
  const entityDate = entity.date ? entity.date.slice(0, 10) : "";
  if (draft.date !== entityDate) changes.date = draft.date || null;
  for (const field of ["client", "project", "task"] as const) {
    const draftValue = draft[field].trim();
    if (draftValue !== (entity[field] ?? "")) changes[field] = draftValue || null;
  }
  return changes;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function EntityCorrectionCard({ entity, index, saving, onSave }: {
  entity: LogEntity;
  index: number;
  saving: boolean;
  onSave: (entityIndex: number, changes: Record<string, string | number | null>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EntityDraft>(() => draftFromEntity(entity));
  const cat = getCat(entity.category);
  const corrections = entity.corrections ?? {};

  function startEditing() {
    setDraft(draftFromEntity(entity));
    setEditing(true);
  }

  async function handleSave() {
    const changes = changesFromDraft(entity, draft);
    if (Object.keys(changes).length > 0) {
      await onSave(index, changes);
    }
    setEditing(false);
  }

  function set<K extends keyof EntityDraft>(field: K, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  const rows: Array<{ field: string; label: string; value: unknown }> = [
    { field: "amount", label: "Amount", value: entity.amount != null ? `${entity.currency || ""} ${entity.amount}`.trim() : null },
    { field: "date", label: "Date", value: entity.date },
    { field: "client", label: "Client", value: entity.client },
    { field: "project", label: "Project", value: entity.project },
    { field: "task", label: "Task", value: entity.task },
    { field: "status", label: "Status", value: entity.status?.replace("_", " ") ?? null },
  ];

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className={"h-1.5 w-1.5 rounded-full " + cat.dot} />
          <span className={"text-[11px] font-medium " + cat.text}>{entity.category}</span>
          <span className="rounded-full border border-zinc-800 px-2 py-px text-[10px] font-medium capitalize text-zinc-500">
            {entity.type.replace("_", " ")}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            {Math.round(entity.confidence * 100)}%
          </span>
        </div>
        {!editing ? (
          <button
            type="button"
            aria-label="Edit"
            onClick={startEditing}
            disabled={saving}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40"
          >
            <Pencil size={11} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Save"
              onClick={handleSave}
              disabled={saving}
              className="flex h-6 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Check size={10} /> Save
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={function () { setEditing(false); }}
              disabled={saving}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3.5 py-3">
          {rows.map(function ({ field, label, value }) {
            if (value === null && !corrections[field]) return null;
            return (
              <div key={field}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {label}
                </p>
                <p className="text-[12.5px] font-medium text-zinc-200 capitalize truncate">
                  {displayValue(value)}
                </p>
                {corrections[field] ? (
                  <p className="font-mono text-[10px] text-amber-400/80">
                    corrected · was {displayValue(corrections[field].from)}
                  </p>
                ) : null}
              </div>
            );
          })}
          {entity.issue_or_risk ? (
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-400/80">Risk</p>
              <p className="text-[12.5px] text-zinc-300">{entity.issue_or_risk}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3.5 py-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Category</Label>
            <Select value={draft.category} onValueChange={function (v) { set("category", v); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(function (c) {
                  return <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Type</Label>
            <Select value={draft.type} onValueChange={function (v) { set("type", v); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(function (t) {
                  return <SelectItem key={t} value={t} className="text-xs capitalize">{t.replace("_", " ")}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Status</Label>
            <Select
              value={draft.status || NONE}
              onValueChange={function (v) { set("status", v === NONE ? "" : v); }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-xs">None</SelectItem>
                {ENTITY_STATUSES.map(function (s) {
                  return <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`amount-${index}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Amount</Label>
            <Input
              id={`amount-${index}`}
              type="number"
              step="any"
              value={draft.amount}
              onChange={function (e) { set("amount", e.target.value); }}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`date-${index}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Date</Label>
            <Input
              id={`date-${index}`}
              type="date"
              value={draft.date}
              onChange={function (e) { set("date", e.target.value); }}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`client-${index}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Client</Label>
            <Input
              id={`client-${index}`}
              value={draft.client}
              onChange={function (e) { set("client", e.target.value); }}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`project-${index}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Project</Label>
            <Input
              id={`project-${index}`}
              value={draft.project}
              onChange={function (e) { set("project", e.target.value); }}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`task-${index}`} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Task</Label>
            <Input
              id={`task-${index}`}
              value={draft.task}
              onChange={function (e) { set("task", e.target.value); }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

**Rewrite `components/log-preview-modal.tsx`** — keep the header/raw-log/conflict/attachment structure from the current version; replace the imports, props, Extracted Data grid, and add the confidence badge + exclude footer:

```tsx
'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, MessageSquare, AlertTriangle, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Label, Switch } from "@/utils/client-integrations/shadcn-ui";
import { getCat } from "@/lib/categories";
import { csrfFetch } from "@/utils/api/csrf";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { EntityCorrectionCard } from "@/components/entity-correction-card";
import { entitiesOf, type Log } from "@/lib/dashboard-utils";

export function LogPreviewModal({ log, onClose, allLogs, onLogUpdated }: {
  log: Log | null;
  onClose: () => void;
  allLogs: Log[];
  onLogUpdated?: (log: Log) => void;
}) {
  const [showAttachment, setShowAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!log) return null;
  const cat = getCat(log.category);
  const entities = entitiesOf(log);
  const confidence = typeof log.ai_confidence === "number" ? log.ai_confidence : null;
  const confidenceCls =
    confidence == null
      ? ""
      : confidence > 0.85
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : confidence >= 0.75
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-rose-500/30 bg-rose-500/10 text-rose-400";

  async function patchLog(body: Record<string, unknown>) {
    if (!log) return;
    setSaving(true);
    try {
      const res = await csrfFetch("/api/logs/" + log.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save changes");
      onLogUpdated?.(data.log as Log);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

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
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={function (e) {
          e.stopPropagation();
        }}
      >
        <div className="px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={"h-8 w-8 shrink-0 rounded-md flex items-center justify-center " + cat.bg}>
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
              {confidence != null ? (
                <div className={"rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium " + confidenceCls}>
                  {Math.round(confidence * 100)}%
                </div>
              ) : null}
              {log.processing_status === "needs_review" ? (
                <div className="flex items-center gap-1.5 rounded-full border border-dashed border-zinc-600 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                  <Eye size={10} /> Review
                </div>
              ) : null}
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

        <div className="flex-1 overflow-y-auto">
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

          <div className="px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-3">
              {entities.length > 1 ? `Extracted Entities (${entities.length})` : "Extracted Entity"}
            </p>
            {log.processing_status === "failed" ? (
              <p className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-relaxed text-rose-300/90">
                Extraction failed for this log. Retry it from the feed — the raw text is preserved.
              </p>
            ) : entities.length === 0 ? (
              <p className="text-xs text-zinc-500">Nothing was extracted from this log.</p>
            ) : (
              <div className="space-y-3">
                {entities.map(function (entity, i) {
                  return (
                    <EntityCorrectionCard
                      key={i}
                      entity={entity}
                      index={i}
                      saving={saving}
                      onSave={function (entityIndex, corrections) {
                        return patchLog({ entityIndex, corrections });
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/80 px-6 py-4">
          <div>
            <Label htmlFor="exclude-from-reports" className="text-[13px] font-medium text-zinc-300">
              Exclude from reports
            </Label>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Kept on the dashboard, skipped when generating client reports
            </p>
          </div>
          <Switch
            id="exclude-from-reports"
            checked={!!log.excluded_from_reports}
            disabled={saving}
            onCheckedChange={function (v) { patchLog({ excludedFromReports: v }); }}
          />
        </div>
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
```

**Wire `onLogUpdated` in `app/page.tsx`** — the `<LogPreviewModal>` call becomes:

```tsx
        {previewLog ? (
          <LogPreviewModal
            log={previewLog}
            allLogs={allLogs}
            onLogUpdated={function (updated: Log) {
              setPreviewLog(updated);
              setAllLogs(function (prev) {
                return prev.map(function (l) { return l.id === updated.id ? updated : l; });
              });
              queryClient.invalidateQueries({ queryKey: ["logs"] });
            }}
            onClose={function () {
              setPreviewLog(null);
            }}
          />
        ) : null}
```

**Verify:** `npx vitest run` — all green; `npx tsc --noEmit` clean.
**Commit:** `feat(trust): Original Log Modal with confidence badge, entity corrections, and report exclusion`

---

## Task 14: Migration gate (user action)

**STOP — user action required before end-to-end verification.**

Ask the user to run `migrations/2026-07-12-extraction-and-trust.sql` in the Supabase dashboard SQL editor (Dashboard → SQL Editor → paste → Run). Remind them the Supabase free tier may need a minute to un-pause first. Do not proceed to Task 15 until they confirm.

---

## Task 15: End-to-end verification

Use the established pattern: mint a throwaway Supabase user via the service-role admin API, sign in for a session, set the `sb-<ref>-auth-token=base64-<session JSON>` cookie in Playwright, then delete the user afterwards. Dev server: `npm run dev`.

Checklist:

1. `npx vitest run` — full suite green.
2. `npx tsc --noEmit` — clean.
3. **Multi-entity extraction:** submit `"Paid R850 for fuel yesterday, and finished the homepage mockup for Acme"` → feed shows the log; open the modal → 2+ entity cards, confidence badge, amounts/clients populated; `date` on the fuel entity is yesterday's date in the user's timezone.
4. **Correction flow:** in the modal, edit an entity's amount → Save → card shows the new value with "corrected · was …" marker; if the log was `needs_review`, the review chip disappears after react-query refetch.
5. **Exclusion:** toggle "Exclude from reports" → generate a report for that period → excluded log's content absent.
6. **Retry path:** temporarily set `GROQ_API_KEY` to an invalid value in `.env.local`, restart dev server, submit a log → toast "Saved, but extraction failed"; feed shows `Failed · retry` chip. Restore the key, restart, click retry → chip clears, entities populated, same log row (no duplicate in feed).
7. **Legacy logs:** logs created before the migration render normally in feed, modal, and widget detail page.
8. **Reports client filter:** generate a report filtered to a client that exists only inside entity arrays → logs found (no 422 "No logs").
9. Screenshot the modal and feed chips for the user.

Then run the `superpowers:finishing-a-development-branch` skill.

---

## Self-review notes

- Spec coverage: data model ✓ (Task 1), categories ✓ (2), accessors/compat ✓ (3–4), normalizer ✓ (5), date resolution ✓ (6), corrections+audit ✓ (7), tiered routing ✓ (8), retry payload ✓ (9), pipeline+failure path+settings bug fix ✓ (10), PATCH+reports ✓ (11), feed chips ✓ (12), Original Log Modal ✓ (13), migration gate ✓ (14), testing ✓ (throughout + 15).
- Deliberate scope holds: no proposed-new-category flow, no canvas blocks, no PDF, no Novos rename.
- `ai_confidence` is never recomputed on correction (spec).
- Migrated logs get confidence 0.8 → never `needs_review` (spec).
