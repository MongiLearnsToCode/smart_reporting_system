'use client';

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  ToggleGroup, ToggleGroupItem,
  Switch, Button, Label, Input, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { Settings } from "lucide-react";
import { CURRENCIES, TIMEZONES, LANGUAGES, type UserSettings } from "@/lib/dashboard-utils";

// Spec §10: monetisation is by block capability. Free already gets all six
// block types; paid tiers unlock manipulation power.
const PLANS = [
  { tier: "free", label: "Free", perk: "All 6 block types" },
  { tier: "starter", label: "Starter", perk: "+ block-to-block conversion" },
  { tier: "pro", label: "Pro", perk: "+ AI canvas commands" },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </p>
  );
}

const selectTriggerClass =
  "border-zinc-800 bg-zinc-900 text-[13px] text-zinc-200 focus:ring-zinc-700";
const selectContentClass = "border-zinc-800 bg-zinc-900 text-zinc-200";
const toggleGroupClass =
  "grid w-full grid-cols-none auto-cols-fr grid-flow-col gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1";
const toggleItemClass =
  "h-7 rounded px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 data-[state=on]:bg-teal-500/15 data-[state=on]:text-teal-300";

export function SettingsModal({ settings, onSave, onClose }: {
  settings: Partial<UserSettings>;
  onSave: (s: Partial<UserSettings>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  function set(key: string, value: Partial<UserSettings>[keyof Partial<UserSettings>]) {
    setForm((f: Partial<UserSettings>) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
        <DialogHeader className="space-y-0 border-b border-zinc-800/80 px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-500/15 text-teal-400">
              <Settings size={15} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-zinc-100">
                Settings
              </DialogTitle>
              <p className="mt-0.5 text-xs font-normal text-zinc-500">
                Tune how Codex reads, groups, and keeps your logs
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Configure application settings including currency, AI behaviour, conflict detection, canvas, and data retention
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-3 p-5">
            <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>Plan</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => {
                  const active = (form.tier ?? "free") === p.tier;
                  return (
                    <button
                      key={p.tier}
                      type="button"
                      onClick={() => set("tier", p.tier)}
                      className={
                        "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors " +
                        (active
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700")
                      }
                    >
                      <span className={"text-[13px] font-semibold " + (active ? "text-violet-300" : "text-zinc-300")}>
                        {p.label}
                      </span>
                      <span className="text-[11px] leading-snug text-zinc-500">{p.perk}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>Currency & Finance</SectionLabel>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[13px] font-normal text-zinc-300">Default currency</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger className={`w-32 ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c} className="text-[13px]">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>AI Behaviour</SectionLabel>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[13px] font-normal text-zinc-300">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger className={`w-48 ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz} className="text-[13px]">{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[13px] font-normal text-zinc-300">Summary language</Label>
                <Select value={form.ai_language} onValueChange={(v) => set("ai_language", v)}>
                  <SelectTrigger className={`w-36 ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {LANGUAGES.map((l) => <SelectItem key={l} value={l} className="text-[13px]">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>Conflict Detection</SectionLabel>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[13px] font-normal text-zinc-300">Enable conflict detection</Label>
                <Switch
                  checked={form.conflict_detection}
                  onCheckedChange={(v) => set("conflict_detection", v)}
                  className="data-[state=checked]:bg-teal-500/70"
                />
              </div>
              {form.conflict_detection ? (
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-[13px] font-normal text-zinc-300">Look-back window (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={form.conflict_dismiss_days}
                    onChange={(e) => set("conflict_dismiss_days", parseInt(e.target.value) || 1)}
                    className="w-20 border-zinc-800 bg-zinc-900 text-right font-mono text-[13px] text-zinc-200"
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>Canvas</SectionLabel>
              <div className="space-y-2">
                <Label className="text-[13px] font-normal text-zinc-300">Default widget sort</Label>
                <ToggleGroup
                  type="single"
                  value={form.default_widget_sort}
                  onValueChange={(v) => { if (v) set("default_widget_sort", v); }}
                  className={toggleGroupClass}
                >
                  <ToggleGroupItem value="title" className={toggleItemClass}>A–Z</ToggleGroupItem>
                  <ToggleGroupItem value="created" className={toggleItemClass}>Created</ToggleGroupItem>
                  <ToggleGroupItem value="recent" className={toggleItemClass}>Recent activity</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-normal text-zinc-300">Canvas density</Label>
                <ToggleGroup
                  type="single"
                  value={form.canvas_density}
                  onValueChange={(v) => { if (v) set("canvas_density", v); }}
                  className={toggleGroupClass}
                >
                  <ToggleGroupItem value="comfortable" className={toggleItemClass}>Comfortable</ToggleGroupItem>
                  <ToggleGroupItem value="compact" className={toggleItemClass}>Compact</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
              <SectionLabel>Data</SectionLabel>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-[13px] font-normal text-zinc-300">Data retention</Label>
                  <p className="mt-0.5 text-xs text-zinc-600">Logs older than this are hidden from the canvas</p>
                </div>
                <Select value={String(form.data_retention_days)} onValueChange={(v) => set("data_retention_days", parseInt(v))}>
                  <SelectTrigger className={`w-32 shrink-0 ${selectTriggerClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="30" className="text-[13px]">30 days</SelectItem>
                    <SelectItem value="60" className="text-[13px]">60 days</SelectItem>
                    <SelectItem value="90" className="text-[13px]">90 days</SelectItem>
                    <SelectItem value="180" className="text-[13px]">180 days</SelectItem>
                    <SelectItem value="365" className="text-[13px]">1 year</SelectItem>
                    <SelectItem value="9999" className="text-[13px]">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 border-t border-zinc-800/80 px-5 py-4 sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="border-teal-500/30 bg-teal-500/10 text-[13px] font-medium text-teal-300 hover:bg-teal-500/20 hover:text-teal-200"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
