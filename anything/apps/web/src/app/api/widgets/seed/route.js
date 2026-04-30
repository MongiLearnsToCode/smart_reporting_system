import { getUser, createClient } from '../../utils/auth';

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
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
      await supabase.from('widgets').upsert(
        { user_id: userId, type: p.type, title: p.title, config: p.config },
        { onConflict: 'user_id,title', ignoreDuplicates: true }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
