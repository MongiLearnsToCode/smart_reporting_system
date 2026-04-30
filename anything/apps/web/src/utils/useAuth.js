import { useCallback } from 'react';
import { createClient } from './supabase/client';

function useAuth() {
  const supabase = createClient();

  const signInWithCredentials = useCallback(async ({ email, password, callbackUrl }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    window.location.href = callbackUrl ?? '/';
  }, [supabase]);

  const signUpWithCredentials = useCallback(async ({ email, password, callbackUrl }) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    window.location.href = callbackUrl ?? '/';
  }, [supabase]);

  const signOut = useCallback(async ({ callbackUrl } = {}) => {
    await supabase.auth.signOut();
    window.location.href = callbackUrl ?? '/account/signin';
  }, [supabase]);

  const signInWithGoogle = useCallback(async ({ callbackUrl } = {}) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl ?? window.location.origin },
    });
  }, [supabase]);

  return { signInWithCredentials, signUpWithCredentials, signOut, signInWithGoogle };
}

export default useAuth;
