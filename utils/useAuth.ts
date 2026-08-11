import { useCallback } from 'react';
import { createClient } from './supabase/client';

type Credentials = { email: string; password: string; callbackUrl?: string; redirect?: boolean };
type SignOutOptions = { callbackUrl?: string };

function useAuth() {
  const supabase = createClient();

  const signInWithCredentials = useCallback(async ({ email, password, callbackUrl }: Credentials): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    window.location.href = callbackUrl ?? '/';
  }, [supabase]);

  const signUpWithCredentials = useCallback(async ({ email, password }: Credentials): Promise<{ emailConfirmationRequired: boolean }> => {
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Password must contain at least one letter and one number');
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw new Error(error.message);
    return { emailConfirmationRequired: true };
  }, [supabase]);

  const signOut = useCallback(async ({ callbackUrl }: SignOutOptions = {}): Promise<void> => {
    await supabase.auth.signOut();
    window.location.href = callbackUrl ?? '/account/signin';
  }, [supabase]);

  const signInWithGoogle = useCallback(async ({ callbackUrl }: SignOutOptions = {}): Promise<void> => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl ?? window.location.origin } });
  }, [supabase]);

  return { signInWithCredentials, signUpWithCredentials, signOut, signInWithGoogle };
}

export default useAuth;
