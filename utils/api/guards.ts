import { NextRequest, NextResponse } from 'next/server';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  const now = Date.now();
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
