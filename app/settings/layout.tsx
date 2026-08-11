import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SettingsNav } from '@/components/settings/settings-nav';

/**
 * Settings is a route, not a modal.
 *
 * Two reasons it had to stop being a dialog. Billing needs a URL that Polar can
 * return a customer to after checkout — you cannot send someone back to a modal.
 * And the four groups here have genuinely different owners: identity belongs to
 * the auth provider, the plan to the billing provider, preferences to the user,
 * projects to their data. A single Save button spanning all four meant one
 * control with four different meanings.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={13} /> Back to canvas
        </Link>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-100">Settings</h1>

        <SettingsNav />

        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}
