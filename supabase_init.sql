-- Rate Limits (for distributed rate limiting across serverless instances)
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  reset_at timestamptz not null
);

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

create index if not exists logs_user_timestamp_idx
  on public.logs (user_id, timestamp desc);

create index if not exists logs_user_category_timestamp_idx
  on public.logs (user_id, category, timestamp desc);

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

create index if not exists widgets_user_created_idx
  on public.widgets (user_id, created_at desc);

create index if not exists widgets_user_title_idx
  on public.widgets (user_id, title);

-- User Settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  ai_language text not null default 'English',
  conflict_detection boolean not null default true,
  conflict_dismiss_days integer not null default 7,
  default_widget_sort text not null default 'title',
  canvas_density text not null default 'comfortable',
  data_retention_days integer not null default 90,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can manage their own settings"
  on public.user_settings for all
  using (auth.uid() = user_id);

-- RLS policies alone do not grant table access; the authenticated role
-- also needs table-level privileges (missing on databases initialised
-- before this line existed — run it there manually).
grant select, insert, update on public.user_settings to authenticated;
