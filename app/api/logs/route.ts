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
    const after = searchParams.get('after');
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));

    if (after) {
      // Forward pagination: entries newer than cursor (sorted ascending, then reversed)
      const { data: logs, error } = await admin
        .from('logs')
        .select('*')
        .eq('user_id', user.id)
        .gt('timestamp', after)
        .order('timestamp', { ascending: true })
        .limit(limit + 1);

      if (error) throw error;

      const hasMore = logs.length > limit;
      if (hasMore) logs.pop();

      return NextResponse.json({ logs: logs.reverse(), hasMore });
    }

    // Backward pagination (default): entries older than cursor, or first page
    let query = admin
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt('timestamp', before);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    return NextResponse.json({ logs, hasMore });
  } catch (error) {
    return toErrorResponse(error);
  }
}
