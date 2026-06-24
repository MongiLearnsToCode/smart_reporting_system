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
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new Error('Password must contain at least one letter and one number');
    }
    const redirectTo = typeof window !== 'undefined'
      ? window.location.origin + '/auth/callback'
      : undefined;
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw new Error(error.message);
    return { emailConfirmationRequired: true };
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
