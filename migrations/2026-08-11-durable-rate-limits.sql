-- Atomic, cross-instance fixed-window rate limiting.
-- Run this in the Supabase SQL editor before deploying the corresponding app
-- code. The API uses the service role, so the function is not granted to
-- browser roles.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
  next_reset_at timestamptz;
begin
  if p_key = '' or p_limit < 1 or p_window_ms < 1 then
    raise exception 'Invalid rate-limit arguments';
  end if;

  insert into public.rate_limits as current (key, count, reset_at)
  values (p_key, 1, now() + (p_window_ms * interval '1 millisecond'))
  on conflict (key) do update
  set
    count = case when current.reset_at <= now() then 1 else current.count + 1 end,
    reset_at = case
      when current.reset_at <= now() then now() + (p_window_ms * interval '1 millisecond')
      else current.reset_at
    end
  returning count, reset_at into next_count, next_reset_at;

  return query select
    next_count <= p_limit,
    greatest(0, ceil(extract(epoch from (next_reset_at - now())) * 1000)::integer);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
