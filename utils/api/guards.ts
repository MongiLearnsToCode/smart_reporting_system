import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function getClientIp(request: NextRequest) {
  // When behind a trusted reverse proxy (e.g. Vercel Edge), x-real-ip is set
  // by the proxy and is more trustworthy than x-forwarded-for which clients can spoof.
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Take the rightmost IP in x-forwarded-for — that's the one added by the last
  // trusted proxy. Clients can only spoof entries to the left.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(function (s) { return s.trim(); });
    return ips[ips.length - 1];
  }

  return 'unknown';
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    throw new Response(JSON.stringify({ error: 'Invalid request origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export function requireCsrf(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const headerToken = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  const supabase = getAdminClient();
  if (!supabase) {
    throw new Response(JSON.stringify({ error: 'Rate limiter unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The database function increments and checks in one transaction. A
  // process-local fallback would reset on a cold start and let requests slip
  // between Vercel instances, so an unavailable limiter fails closed instead.
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: options.limit,
    p_window_ms: options.windowMs,
  });
  const result = Array.isArray(data) ? data[0] as { allowed?: unknown } | undefined : undefined;
  if (error || !result || typeof result.allowed !== 'boolean') {
    throw new Response(JSON.stringify({ error: 'Rate limiter unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!result.allowed) {
    throw new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof Response) return error;
  return jsonError('Request failed', 500);
}
