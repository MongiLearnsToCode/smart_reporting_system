'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The four groups, in the order someone is likely to want them: their own
// details, what they pay, how the app behaves, then their data.
const TABS = [
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/preferences', label: 'Preferences' },
  { href: '/settings/projects', label: 'Projects' },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-zinc-800/80">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={
              'shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (active
                ? 'border-teal-400 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300')
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
