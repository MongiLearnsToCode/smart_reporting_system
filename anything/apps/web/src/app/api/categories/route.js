import { getUser, createClient } from '../utils/auth';

export async function GET(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.eq.system`)
      .order('name', { ascending: true });

    if (error) throw error;
    return Response.json({ categories });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
