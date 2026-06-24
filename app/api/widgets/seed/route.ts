import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { parseIndustry } from '@/utils/api/validation';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const industry = parseIndustry(await request.json());
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
      const { data: existing } = await admin
        .from('widgets')
        .select('id')
        .eq('user_id', userId)
        .eq('title', p.title)
        .limit(1);

      if (!existing?.length) {
        await admin.from('widgets').insert({
          user_id: userId,
          type: p.type,
          title: p.title,
          config: p.config,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
