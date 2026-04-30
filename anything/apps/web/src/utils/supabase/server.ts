import { createServerClient } from '@supabase/ssr';
import { getContext } from 'hono/context-storage';

export function createClient() {
  const c = getContext();
  const cookieHeader = c.req.header('cookie') ?? '';

  // Parse cookies from header
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((s) => {
      const [k, ...v] = s.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            const parts = [`${name}=${encodeURIComponent(value)}`];
            if (options?.path) parts.push(`Path=${options.path}`);
            if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
            if (options?.httpOnly) parts.push('HttpOnly');
            if (options?.secure) parts.push('Secure');
            if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
            c.header('Set-Cookie', parts.join('; '), { append: true });
          }
        },
      },
    }
  );
}
