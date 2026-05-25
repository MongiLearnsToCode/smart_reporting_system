import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, toErrorResponse } from '@/utils/api/guards';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: widgets, error } = await admin
      .from('widgets')
      .select('*')
      .eq('user_id', user.id)
      .order('id', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ widgets });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`widgets:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const type = body?.type === 'chart' || body?.type === 'list' ? body.type : 'metric';
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 80) : '';
    const config = body?.config && typeof body.config === 'object' && !Array.isArray(body.config)
      ? body.config
      : {};

    if (!title) {
      return NextResponse.json({ error: 'Widget title is required' }, { status: 400 });
    }

    const { data: widget, error } = await admin
      .from('widgets')
      .insert({ user_id: user.id, type, title, config })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ widget });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}
