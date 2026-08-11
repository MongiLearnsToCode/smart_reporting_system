import { redirect } from 'next/navigation';

// /settings itself is not a page — preferences is the tab people actually come
// for, so it stands in as the default rather than showing an empty shell.
export default function SettingsIndex() {
  redirect('/settings/preferences');
}
