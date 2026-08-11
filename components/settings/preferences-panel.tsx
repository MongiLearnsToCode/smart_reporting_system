'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch, ToggleGroup, ToggleGroupItem,
} from '@/utils/client-integrations/shadcn-ui';
import { CURRENCIES, TIMEZONES, LANGUAGES, type UserSettings } from '@/lib/dashboard-utils';
import { csrfFetch } from '@/utils/api/csrf';
import { SettingsSection, SettingsRow } from '@/components/settings/section';

const DEFAULTS: UserSettings = {
  currency: 'USD',
  timezone: 'UTC',
  ai_language: 'English',
  conflict_detection: true,
  conflict_dismiss_days: 7,
  default_widget_sort: 'title',
  canvas_density: 'comfortable',
  data_retention_days: 90,
};

const triggerClass = 'border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200 focus:ring-zinc-700';
const contentClass = 'border-zinc-800 bg-zinc-900 text-zinc-200';
const groupClass =
  'grid w-full grid-cols-none auto-cols-fr grid-flow-col gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1';
const itemClass =
  'h-7 rounded px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 data-[state=on]:bg-teal-500/15 data-[state=on]:text-teal-300';

export function PreferencesPanel() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState<UserSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  // Held aside until confirmed — see the dialog at the bottom of this file.
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      return res.json();
    },
  });

  const saved: Partial<UserSettings> = settingsQuery.data?.settings ?? {};

  // Seed the form once the stored values arrive. Guarded by `loaded` rather than
  // keyed off the query so a background refetch can't discard an in-progress edit.
  useEffect(() => {
    if (loaded || !settingsQuery.data) return;
    setForm({ ...DEFAULTS, ...saved });
    setLoaded(true);
  }, [settingsQuery.data, loaded, saved]);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<UserSettings>) => {
      const res = await csrfFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      return data as { settings: UserSettings; reconverted?: number };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], { settings: data.settings });
      // The re-conversion count was already coming back from the API and being
      // thrown away. Changing currency rewrites every stored conversion; the
      // person who asked for it deserves to see that it happened.
      if (data.reconverted) {
        toast.success(
          `Preferences saved — ${data.reconverted} ${data.reconverted === 1 ? 'entry' : 'entries'} re-converted to ${data.settings.currency}`,
        );
      } else {
        toast.success('Preferences saved');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const currencyChanged = loaded && !!saved.currency && form.currency !== saved.currency;

  function handleSave() {
    // Currency is the one field here with a side effect on stored data, so it
    // is the one field that asks first. Everything else is inert until Save.
    if (currencyChanged) {
      setPendingCurrency(form.currency);
      return;
    }
    mutation.mutate(form);
  }

  return (
    <div className="space-y-3">
      <SettingsSection
        title="Currency & finance"
        description="Entries logged in another currency are converted to this one."
      >
        <SettingsRow
          label="Default currency"
          hint={currencyChanged ? 'Changing this re-converts every existing entry.' : undefined}
        >
          <Select value={form.currency} onValueChange={(v: string) => set('currency', v)}>
            <SelectTrigger className={`w-32 ${triggerClass}`}><SelectValue /></SelectTrigger>
            <SelectContent className={contentClass}>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c} className="text-[13px]">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="AI behaviour">
        <SettingsRow label="Timezone" hint="Dates like “yesterday” are resolved against this.">
          <Select value={form.timezone} onValueChange={(v: string) => set('timezone', v)}>
            <SelectTrigger className={`w-48 ${triggerClass}`}><SelectValue /></SelectTrigger>
            <SelectContent className={contentClass}>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz} className="text-[13px]">{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="Summary language">
          <Select value={form.ai_language} onValueChange={(v: string) => set('ai_language', v)}>
            <SelectTrigger className={`w-36 ${triggerClass}`}><SelectValue /></SelectTrigger>
            <SelectContent className={contentClass}>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l} className="text-[13px]">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Conflict detection"
        description="Flags an entry that contradicts something you logged earlier."
      >
        <SettingsRow label="Enable conflict detection">
          <Switch
            checked={form.conflict_detection}
            onCheckedChange={(v: boolean) => set('conflict_detection', v)}
            className="data-[state=checked]:bg-teal-500/70"
          />
        </SettingsRow>
        {form.conflict_detection ? (
          <SettingsRow label="Look-back window (days)">
            <Input
              type="number"
              min={1}
              max={90}
              value={form.conflict_dismiss_days}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                set('conflict_dismiss_days', parseInt(e.target.value) || 1)
              }
              className="w-20 border-zinc-800 bg-zinc-900 text-right font-mono text-[13px] text-zinc-200"
            />
          </SettingsRow>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Canvas">
        <div className="space-y-2">
          <p className="text-[13px] text-zinc-300">Default block sort</p>
          <ToggleGroup
            type="single"
            value={form.default_widget_sort}
            onValueChange={(v: string) => { if (v) set('default_widget_sort', v as UserSettings['default_widget_sort']); }}
            className={groupClass}
          >
            <ToggleGroupItem value="title" className={itemClass}>A–Z</ToggleGroupItem>
            <ToggleGroupItem value="created" className={itemClass}>Created</ToggleGroupItem>
            <ToggleGroupItem value="recent" className={itemClass}>Recent activity</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <p className="text-[13px] text-zinc-300">Canvas density</p>
          <ToggleGroup
            type="single"
            value={form.canvas_density}
            onValueChange={(v: string) => {
              if (v === 'comfortable' || v === 'compact') set('canvas_density', v);
            }}
            className={groupClass}
          >
            <ToggleGroupItem value="comfortable" className={itemClass}>Comfortable</ToggleGroupItem>
            <ToggleGroupItem value="compact" className={itemClass}>Compact</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </SettingsSection>

      {/* Theme is stored by next-themes on this device, not in the settings
          blob, so it applies immediately and has no part in Save. */}
      <SettingsSection title="Appearance" description="Applies to this device only.">
        <div className="space-y-2">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v: string) => {
              if (v === 'dark' || v === 'light' || v === 'system') setTheme(v);
            }}
            className={groupClass}
          >
            <ToggleGroupItem value="dark" className={itemClass}>Dark</ToggleGroupItem>
            <ToggleGroupItem value="light" className={itemClass}>Light</ToggleGroupItem>
            <ToggleGroupItem value="system" className={itemClass}>System</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingsRow
          label="Data retention"
          hint="Entries older than this are hidden from the canvas. Nothing is deleted."
        >
          <Select
            value={String(form.data_retention_days)}
            onValueChange={(v: string) => set('data_retention_days', parseInt(v))}
          >
            <SelectTrigger className={`w-32 ${triggerClass}`}><SelectValue /></SelectTrigger>
            <SelectContent className={contentClass}>
              <SelectItem value="30" className="text-[13px]">30 days</SelectItem>
              <SelectItem value="60" className="text-[13px]">60 days</SelectItem>
              <SelectItem value="90" className="text-[13px]">90 days</SelectItem>
              <SelectItem value="180" className="text-[13px]">180 days</SelectItem>
              <SelectItem value="365" className="text-[13px]">1 year</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !loaded}
          variant="outline"
          className="border-teal-500/30 bg-teal-500/10 text-[13px] font-medium text-teal-300 hover:bg-teal-500/20 hover:text-teal-200"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <AlertDialog open={!!pendingCurrency} onOpenChange={(open: boolean) => { if (!open) setPendingCurrency(null); }}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Convert everything to {pendingCurrency}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Every entry you have logged will be re-converted from the amount you
              originally entered, at the exchange rate for its own date. The original
              amounts and currencies are kept, so this can be changed back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 bg-transparent text-[13px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setPendingCurrency(null); mutation.mutate(form); }}
              className="border-teal-500/30 bg-teal-500/10 text-[13px] text-teal-300 hover:bg-teal-500/20 hover:text-teal-200"
            >
              Convert and save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
