import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { DEFAULT_SETTINGS, parseSettings } from '@/utils/api/validation';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
  return NextResponse.json({ settings: data ?? { ...DEFAULT_SETTINGS, user_id: user.id } });
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = parseSettings(await request.json());
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Settings update failed' }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
