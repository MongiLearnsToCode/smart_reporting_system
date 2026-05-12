import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: log, error: fetchError } = await admin
      .from('logs')
      .select('category, raw_content')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await admin
      .from('logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    await admin.from('logs').insert({
      user_id: user.id,
      category: log.category,
      type: 'text',
      raw_content: `Reverted conflict: "${log.raw_content?.slice(0, 120)}${log.raw_content?.length > 120 ? '…' : ''}"`,
      entities: {},
      is_conflict: false,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
