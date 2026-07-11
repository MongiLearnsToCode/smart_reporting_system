import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set([
  '/account/signin',
  '/account/signup',
  '/api/csrf-token',
  '/auth/callback',
]);

/**
 * Lightweight auth gate. We only check for the presence of a Supabase session
 * cookie here — no network call — so middleware stays fast and never risks a
 * MIDDLEWARE_INVOCATION_TIMEOUT on the Edge runtime. Authoritative validation
 * (verifying the token with the auth server) happens in API routes and pages
 * via supabase.auth.getUser(); an expired-but-present cookie will be rejected
 * there and the user redirected to sign in.
 */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next();
  }

  if (!hasSupabaseSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = '/account/signin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
