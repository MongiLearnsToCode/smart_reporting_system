import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');

    let query = supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (before) {
      query = query.lte('timestamp', before);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
