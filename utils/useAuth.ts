import { useCallback } from 'react';
import { createClient } from './supabase/client';
import { csrfFetch } from './api/csrf';

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
    const response = await csrfFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error
        : 'Could not create your account';
      throw new Error(message);
    }
    return { emailConfirmationRequired: true };
  }, []);

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
