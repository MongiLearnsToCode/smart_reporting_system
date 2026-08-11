import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import { logError } from './logger';

export type UserResult = {
  user: User | null;
  data: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

export function useUser(): UserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser()
      .then(({ data }) => setUser(data.user))
      .catch((error: unknown) => {
        logError('auth.load-user', error);
        setUser(null);
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refetch = useCallback(async () => {
    try {
      const { data } = await createClient().auth.getUser();
      setUser(data.user);
    } catch (error) {
      logError('auth.refresh-user', error);
      setUser(null);
    }
  }, []);

  return { user, data: user, loading, refetch };
}

export default useUser;
