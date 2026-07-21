import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq } from '@/utils/api/groq';
import { convexForUser } from '@/utils/convex/serverClient';
import { api } from '@/convex/_generated/api';

// How many recent logs feed the narrative. Bounded so the prompt stays cheap
// and the Groq call stays within the latency budget.
const MAX_LOGS = 40;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`summary:${getClientIp(request)}`, { limit: 10, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const blockId = typeof body?.blockId === 'string' ? body.blockId : null;
    if (!blockId) {
      return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
    }

    const convex = convexForUser(session.access_token);
    const block = await convex.query(api.blocks.getById, { id: blockId as never });
    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }
    if (block.type !== 'summary') {
      return NextResponse.json({ error: 'Not a summary block' }, { status: 400 });
    }

    const category = block.queryConfig?.category;
    const logs = await convex.query(api.logs.list, {});
    const relevant = logs
      .filter((l) => !l.excludedFromReports && (!category || l.category === category))
      .slice(0, MAX_LOGS)
      .map((l) => ({
        timestamp: new Date(l.timestamp).toISOString(),
        category: l.category,
        content: l.rawContent,
        entities: l.entities,
      }));

    if (relevant.length === 0) {
      return NextResponse.json(
        { error: category ? `No ${category} logs to summarize yet` : 'No logs to summarize yet' },
        { status: 422 },
      );
    }

    const scope = category ? `the "${category}" area of the business` : 'the business';
    const summary = await callGroq([
      {
        role: 'system',
        content: [
          `You write a short status narrative for ${scope}, titled "${block.title}".`,
          'Base it ONLY on the logs provided — never invent facts, numbers, or names.',
          'Tone: professional, concrete, first-person-plural ("we"). No preamble, no headings, no markdown.',
          'Length: 2 to 4 sentences. Lead with what was accomplished, then note anything urgent or outstanding.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify(relevant) },
    ]);

    await convex.mutation(api.blocks.setSummary, { id: blockId as never, summary });

    return NextResponse.json({ summary: summary.trim(), summaryAt: Date.now() });
  } catch (error) {
    console.error('api/blocks/summary error:', error);
    return toErrorResponse(error);
  }
}
