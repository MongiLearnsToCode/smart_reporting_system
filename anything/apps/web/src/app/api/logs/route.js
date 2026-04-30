import { getUser, createClient } from '../utils/auth';

export async function GET(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before');

    let query = supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (before) query = query.lte('timestamp', before);

    const { data: logs, error } = await query;
    if (error) throw error;

    return Response.json({ logs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
