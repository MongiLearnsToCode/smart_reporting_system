'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

// Bridges the Supabase session into Convex's auth contract. Convex calls
// `fetchAccessToken` and forwards the returned JWT; `convex/auth.config.ts`
// validates it against Supabase's JWKS. Mirrors the session-tracking pattern
// in utils/useUser.js.
export function useConvexAuthFromSupabase() {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // getSession() returns the cached token and transparently refreshes it
      // when expired, which covers the forceRefreshToken case.
      void forceRefreshToken;
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    },
    [supabase],
  );

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}
