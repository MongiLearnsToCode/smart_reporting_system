import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { logError } from '@/utils/logger';

function validCredentials(value: unknown): value is { email: string; password: string } {
  if (!value || typeof value !== 'object') return false;
  const { email, password } = value as Record<string, unknown>;
  return typeof email === 'string' && typeof password === 'string';
}

function passwordError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`signup:${getClientIp(request)}`, { limit: 5, windowMs: 60_000 });

    const body: unknown = await request.json();
    if (!validCredentials(body)) return NextResponse.json({ error: 'Invalid signup request' }, { status: 400 });

    const email = body.email.trim();
    const error = passwordError(body.password);
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase signup is not configured');
    const supabase = createClient(url, key);
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: { emailRedirectTo: new URL('/auth/callback', request.url).toString() },
    });
    if (signupError) return NextResponse.json({ error: signupError.message }, { status: 400 });
    return NextResponse.json({ emailConfirmationRequired: true });
  } catch (error) {
    logError('api.auth.signup', error);
    return toErrorResponse(error);
  }
}
