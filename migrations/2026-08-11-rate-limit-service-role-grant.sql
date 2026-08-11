-- The API calls consume_rate_limit with Supabase's server-only service_role.
-- REVOKE from PUBLIC is correct, but service_role must retain explicit EXECUTE.
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.prune_expired_rate_limits() to service_role;
