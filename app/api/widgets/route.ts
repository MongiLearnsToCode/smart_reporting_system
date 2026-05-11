import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const { data: widget, error } = await admin
      .from('widgets')
      .insert({ user_id: user.id, type: body.type, title: body.title, config: body.config })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ widget });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
