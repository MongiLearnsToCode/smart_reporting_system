import { QueryCtx, MutationCtx } from '../_generated/server';

// Resolves the calling user's id from the validated Supabase JWT.
// `subject` is the Supabase user id (the JWT `sub` claim).
export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}

// Non-throwing variant for queries that should return empty rather than error
// while a session is still loading.
export async function optionalUserId(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}
