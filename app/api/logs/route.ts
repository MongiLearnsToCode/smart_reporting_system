import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/utils/api/guards';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 100));

    let query = admin
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lte('timestamp', before);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}
