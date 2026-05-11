import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { industry } = await request.json();
    const userId = user.id;

    const presets = [
      { type: 'metric', title: 'Total Expenses', config: { category: 'Finance', w: 4, h: 2, x: 0, y: 0 } },
      { type: 'chart', title: 'Financial Trends', config: { category: 'Finance', w: 8, h: 2, x: 4, y: 0 } },
      { type: 'list', title: 'Pending Tasks', config: { category: 'Tasks', w: 4, h: 4, x: 0, y: 2 } },
    ];

    if (industry === 'solo') {
      presets.push({ type: 'metric', title: 'Active Projects', config: { category: 'Projects', w: 4, h: 2, x: 4, y: 2 } });
    } else if (industry === 'freelance') {
      presets.push({ type: 'metric', title: 'Client Sentiment', config: { category: 'Clients', w: 4, h: 2, x: 4, y: 2 } });
    }

    for (const p of presets) {
      await admin.from('widgets').upsert(
        { user_id: userId, type: p.type, title: p.title, config: p.config },
        { onConflict: 'user_id,title', ignoreDuplicates: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
