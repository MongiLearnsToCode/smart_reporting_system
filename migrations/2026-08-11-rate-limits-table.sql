-- Required backing table for consume_rate_limit(). Kept private from browser
-- roles; only the server-side RPC uses it.
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
