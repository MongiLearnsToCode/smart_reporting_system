'use client';

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch, Button, Label, Input, ScrollArea,
} from "@/utils/client-integrations/shadcn-ui";
import { Settings } from "lucide-react";
import { CURRENCIES, TIMEZONES, LANGUAGES, type UserSettings } from "@/lib/dashboard-utils";

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
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-white p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Settings size={15} className="text-zinc-400" /> Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure application settings including currency, AI behaviour, conflict detection, canvas, and data retention
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="divide-y divide-zinc-800/60">
            {/* Currency & Finance */}
            <section className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Currency & Finance</p>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Default currency</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* AI Behaviour */}
            <section className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">AI Behaviour</p>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz} className="text-white">{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Summary language</Label>
                <Select value={form.ai_language} onValueChange={(v) => set("ai_language", v)}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {LANGUAGES.map((l) => <SelectItem key={l} value={l} className="text-white">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Conflicts */}
            <section className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Conflict Detection</p>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Enable conflict detection</Label>
                <Switch
                  checked={form.conflict_detection}
                  onCheckedChange={(v) => set("conflict_detection", v)}
                />
              </div>
              {form.conflict_detection ? (
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm text-zinc-300">Look-back window (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={form.conflict_dismiss_days}
                    onChange={(e) => set("conflict_dismiss_days", parseInt(e.target.value) || 1)}
                    className="w-20 bg-zinc-900 border-zinc-700 text-white text-right"
                  />
                </div>
              ) : null}
            </section>

            {/* Canvas */}
            <section className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Canvas</p>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Default widget sort</Label>
                <Select value={form.default_widget_sort} onValueChange={(v) => set("default_widget_sort", v)}>
                  <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="title" className="text-white">A–Z</SelectItem>
                    <SelectItem value="created" className="text-white">Created</SelectItem>
                    <SelectItem value="recent" className="text-white">Recent activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-zinc-300">Canvas density</Label>
                <Select value={form.canvas_density} onValueChange={(v) => set("canvas_density", v)}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="comfortable" className="text-white">Comfortable</SelectItem>
                    <SelectItem value="compact" className="text-white">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Data */}
            <section className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Data</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm text-zinc-300">Data retention</Label>
                  <p className="text-xs text-zinc-600 mt-0.5">Logs older than this are hidden from the canvas</p>
                </div>
                <Select value={String(form.data_retention_days)} onValueChange={(v) => set("data_retention_days", parseInt(v))}>
                  <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="30" className="text-white">30 days</SelectItem>
                    <SelectItem value="60" className="text-white">60 days</SelectItem>
                    <SelectItem value="90" className="text-white">90 days</SelectItem>
                    <SelectItem value="180" className="text-white">180 days</SelectItem>
                    <SelectItem value="365" className="text-white">1 year</SelectItem>
                    <SelectItem value="9999" className="text-white">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 sm:justify-end">
          <Button variant="outline" onClick={onClose} className="border-zinc-800 text-zinc-400 hover:text-white bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-zinc-200">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
