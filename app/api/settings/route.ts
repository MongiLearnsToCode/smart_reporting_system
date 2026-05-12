import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULTS = {
  currency: 'USD',
  timezone: 'UTC',
  ai_language: 'English',
  conflict_detection: true,
  conflict_dismiss_days: 7,
  default_widget_sort: 'title',
  canvas_density: 'comfortable',
  data_retention_days: 90,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin.from('user_settings').select('*').eq('user_id', user.id).single();
  return NextResponse.json({ settings: data ?? { ...DEFAULTS, user_id: user.id } });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('user_settings')
    .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
