import { getUser, createClient } from '../utils/auth';

export async function GET(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const { data: widgets, error } = await supabase
      .from('widgets')
      .select('*')
      .eq('user_id', user.id)
      .order('id', { ascending: true });

    if (error) throw error;
    return Response.json({ widgets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const body = await request.json();
    const { data: widget, error } = await supabase
      .from('widgets')
      .insert({ user_id: user.id, type: body.type, title: body.title, config: body.config })
      .select()
      .single();

    if (error) throw error;
    return Response.json({ widget });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
