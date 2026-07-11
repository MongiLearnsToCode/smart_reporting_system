import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { DEFAULT_SETTINGS, parseSettings } from '@/utils/api/validation';

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

  const stored = user.user_metadata?.settings;
  const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}), user_id: user.id };
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = parseSettings(await request.json());
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
    return NextResponse.json({ settings: { ...body, user_id: user.id } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
