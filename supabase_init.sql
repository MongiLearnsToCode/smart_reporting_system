-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  color text not null default '#94a3b8',
  is_proposed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "Users can manage their own categories"
  on public.categories for all
  using (auth.uid()::text = user_id or user_id = 'system');

-- Logs
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_content text not null,
  type text,
  file_url text,
  category text,
  entities jsonb,
  is_conflict boolean not null default false,
  conflict_source_id uuid references public.logs(id),
  conflict_reason text,
  timestamp timestamptz not null default now()
);

alter table public.logs enable row level security;

create policy "Users can manage their own logs"
  on public.logs for all
  using (auth.uid() = user_id);

-- Widgets
create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.widgets enable row level security;

create policy "Users can manage their own widgets"
  on public.widgets for all
  using (auth.uid() = user_id);
