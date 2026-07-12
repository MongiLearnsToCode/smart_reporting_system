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
