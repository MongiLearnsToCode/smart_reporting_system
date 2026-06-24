import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const buckets = new Map<string, { count: number; resetAt: number }>();

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
  const now = Date.now();

  const supabase = getAdminClient();
  if (supabase) {
    try {
      const resetAt = new Date(now + options.windowMs).toISOString();
      const { data, error } = await supabase
        .from('rate_limits')
        .upsert(
          { key, count: 1, reset_at: resetAt },
          { onConflict: 'key', ignoreDuplicates: true },
        )
        .select('count, reset_at')
        .single();

      if (!error && data) {
        const dbResetAt = new Date(data.reset_at).getTime();
        if (dbResetAt <= now) {
          await supabase
            .from('rate_limits')
            .update({ count: 1, reset_at: resetAt })
            .eq('key', key);
          return;
        }
        if (data.count >= options.limit) {
          throw new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        await supabase
          .from('rate_limits')
          .update({ count: data.count + 1 })
          .eq('key', key);
        return;
      }
    } catch (e) {
      if (e instanceof Response) throw e;
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  if (bucket.count >= options.limit) {
    throw new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  bucket.count += 1;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof Response) return error;
  return jsonError('Request failed', 500);
}
