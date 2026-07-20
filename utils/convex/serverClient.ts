import { ConvexHttpClient } from 'convex/browser';

// Server-side Convex client authenticated as the calling user. The Supabase
// access token is validated by convex/auth.config.ts, so Convex functions see
// the same identity (ctx.auth.getUserIdentity().subject) as the browser would.
export function convexForUser(accessToken: string): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  const client = new ConvexHttpClient(url);
  client.setAuth(accessToken);
  return client;
}
