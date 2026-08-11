'use client';

import { useEffect, useState } from 'react';
import { LogOut, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { Button, Input } from '@/utils/client-integrations/shadcn-ui';
import { createClient } from '@/utils/supabase/client';
import { SettingsSection, SettingsRow } from '@/components/settings/section';

/**
 * Identity, which belongs to Supabase auth — not to the settings blob.
 *
 * Email and password changes go through Supabase directly rather than through
 * /api/settings, because they are credential changes: they trigger a
 * confirmation email and re-issue the session. Routing them through a form that
 * also saves the user's timezone would hide that.
 */
export function AccountPanel() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setName((data.user?.user_metadata?.full_name as string) ?? '');
      setCompanyName((data.user?.user_metadata?.company_name as string) ?? '');
    });
    // supabase is recreated per render by createClient(); the effect only needs
    // to run once, and re-running it would refetch the same user forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveName() {
    setBusy('name');
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success('Name updated');
  }

  async function saveCompanyName() {
    setBusy('company');
    const { error } = await supabase.auth.updateUser({ data: { company_name: companyName.trim() } });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success('Company name updated');
  }

  async function changePassword() {
    if (password.length < 8) {
      toast.error('Use at least 8 characters');
      return;
    }
    setBusy('password');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      setPassword('');
      toast.success('Password changed');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/account/signin';
  }

  return (
    <div className="space-y-3">
      <SettingsSection title="Profile">
        <SettingsRow label="Email" hint="Used to sign in, and by Polar for billing receipts.">
          <span className="flex items-center gap-1.5 text-[13px] text-zinc-400">
            <Mail size={13} className="text-zinc-600" />
            {user?.email ?? '—'}
          </span>
        </SettingsRow>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="full-name" className="text-[13px] font-normal text-zinc-300">
              Display name
            </label>
            <Input
              id="full-name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Your name"
              className="border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200"
            />
          </div>
          <Button
            onClick={saveName}
            disabled={busy === 'name'}
            variant="outline"
            className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          >
            {busy === 'name' ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="company-name" className="text-[13px] font-normal text-zinc-300">
              Company name
            </label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
              placeholder="Your company"
              className="border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200"
            />
          </div>
          <Button
            onClick={saveCompanyName}
            disabled={busy === 'company'}
            variant="outline"
            className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          >
            {busy === 'company' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Password">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="new-password" className="text-[13px] font-normal text-zinc-300">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200"
            />
          </div>
          <Button
            onClick={changePassword}
            disabled={busy === 'password' || !password}
            variant="outline"
            className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          >
            {busy === 'password' ? 'Changing…' : 'Change'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Session">
        <Button
          onClick={signOut}
          variant="outline"
          className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <LogOut size={13} />
          <span className="ml-1.5">Sign out</span>
        </Button>
      </SettingsSection>
    </div>
  );
}
