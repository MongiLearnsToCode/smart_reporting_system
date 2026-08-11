-- Run this daily via Supabase Cron / pg_cron after applying the durable limiter.
-- It retains a one-day diagnostic window while bounding the table even when an
-- attacker creates many distinct rate-limit keys.
create or replace function public.prune_expired_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.rate_limits
  where reset_at < now() - interval '1 day';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_expired_rate_limits() from public;

-- In the Supabase SQL editor, enable pg_cron then schedule this once:
-- select cron.schedule('prune-rate-limits', '17 3 * * *',
--   $$select public.prune_expired_rate_limits();$$);
