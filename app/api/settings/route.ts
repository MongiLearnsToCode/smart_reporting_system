import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { DEFAULT_SETTINGS, parseSettings } from '@/utils/api/validation';
import { reconvertAllLogs } from '@/utils/api/fx-backfill';
import { convexForUser } from '@/utils/convex/serverClient';

// Settings live in auth.users.user_metadata.settings, not in the
// public.user_settings table: the hosted database was created without table
// grants for the authenticated/service_role roles (42501 on every access),
// so the table has never been reachable through the API. user_metadata needs
// no grants and survives with zero DDL. supabase_init.sql documents the
// GRANT needed if this ever moves back to the table.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Read through the same whitelist as writes. Stored blobs outlive the code
  // that wrote them: a value this build no longer offers (the old "Forever"
  // retention, a since-removed `tier`) would otherwise reach the UI and render
  // as an empty control with no way to tell what it was set to.
  const stored = user.user_metadata?.settings;
  const settings = { ...parseSettings(stored), user_id: user.id };
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = parseSettings(await request.json());
    const previous = user.user_metadata?.settings;
    const previousCurrency =
      previous && typeof previous === 'object' && typeof (previous as Record<string, unknown>).currency === 'string'
        ? ((previous as Record<string, unknown>).currency as string)
        : DEFAULT_SETTINGS.currency;
    const admin = createAdminClient();
    // admin updateUserById merges user_metadata shallowly, so top-level keys
    // like full_name / avatar_url are preserved
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { settings: body },
    });

    if (error) {
      console.error('Settings update failed:', error);
      return NextResponse.json({ error: 'Settings update failed' }, { status: 500 });
    }

    // Changing the default currency invalidates every stored conversion — they
    // all target the old currency. Re-derive them from the originals, which are
    // never overwritten precisely so this is possible. Best-effort: a failure
    // here leaves entries in their original currency, which the report handles.
    let reconverted = 0;
    if (session && body.currency !== previousCurrency) {
      try {
        reconverted = await reconvertAllLogs(convexForUser(session.access_token), body.currency);
      } catch (fxError) {
        console.error('currency backfill failed:', fxError);
      }
    }
    return NextResponse.json({ settings: { ...body, user_id: user.id }, reconverted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
