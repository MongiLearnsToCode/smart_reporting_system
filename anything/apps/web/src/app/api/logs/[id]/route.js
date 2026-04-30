import { getUser, createClient } from '../../utils/auth';

export async function DELETE(request, { params }) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const { error } = await supabase
      .from('logs')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
