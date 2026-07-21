import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson } from '@/utils/api/groq';
import { convexForUser } from '@/utils/convex/serverClient';
import { api } from '@/convex/_generated/api';
import { normalizeTier, tierAllows } from '@/lib/tiers';

const BLOCK_TYPES = ['metric', 'chart', 'list', 'timeline', 'summary', 'source_log'] as const;
type BlockType = (typeof BLOCK_TYPES)[number];
const isType = (v: unknown): v is BlockType => typeof v === 'string' && (BLOCK_TYPES as readonly string[]).includes(v);
const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');

// AI natural-language canvas commands (spec §5 P1, Pro tier §10). The model
// translates a free-text command into a small whitelist of operations over the
// user's *actual* blocks; the route validates every op and applies it via the
// same mutations the UI uses.
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`canvas-cmd:${getClientIp(request)}`, { limit: 15, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Enforce the Pro gate server-side, not just in the UI (spec §10).
    const tier = normalizeTier(user.user_metadata?.settings?.tier);
    if (!tierAllows(tier, 'nlCommands')) {
      return NextResponse.json({ error: 'Canvas commands require the Pro plan' }, { status: 403 });
    }

    const body = await request.json();
    const command = typeof body?.command === 'string' ? body.command.trim().slice(0, 400) : '';
    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const convex = convexForUser(session.access_token);
    type BlockRow = { _id: string; type: string; title: string; visible: boolean; queryConfig?: { category?: string } };
    const blocks = (await convex.query(api.blocks.list, {})) as unknown as BlockRow[];
    const known = new Map(blocks.map((b) => [b._id, b]));

    const catalogue = blocks.map((b) => ({
      id: b._id,
      type: b.type,
      title: b.title,
      category: b.queryConfig?.category ?? null,
      visible: b.visible,
    }));

    const system = [
      'You translate a natural-language canvas command into JSON operations over a dashboard of blocks.',
      'Return ONLY JSON, no markdown: {"operations": Operation[], "note": "one short sentence describing what you did"}.',
      'Operation is one of:',
      '{"op":"create","type":BlockType,"title":string,"category"?:string}',
      '{"op":"hide","blockId":string}',
      '{"op":"show","blockId":string}',
      '{"op":"convert","blockId":string,"type":BlockType}',
      '{"op":"rename","blockId":string,"title":string}',
      '{"op":"set_category","blockId":string,"category":string}',
      `BlockType is one of: ${BLOCK_TYPES.join(', ')}.`,
      'Only reference blockId values that appear in the provided blocks list.',
      'For "show only X" commands, hide the non-matching blocks and show the matching ones.',
      'Never invent data. If the command cannot be satisfied, return an empty operations array with an explanatory note.',
    ].join('\n');

    const aiResponse = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ command, blocks: catalogue }) },
    ]);

    const parsed = extractJson(aiResponse);
    const ops: unknown[] = Array.isArray(parsed?.operations) ? parsed.operations : [];
    const note = typeof parsed?.note === 'string' ? parsed.note.slice(0, 200) : '';

    let applied = 0;
    for (const raw of ops.slice(0, 20)) {
      const op = raw as Record<string, unknown>;
      const id = typeof op.blockId === 'string' ? op.blockId : '';
      try {
        switch (op.op) {
          case 'create':
            if (isType(op.type) && clean(op.title)) {
              await convex.mutation(api.blocks.create, {
                type: op.type,
                title: clean(op.title),
                queryConfig: clean(op.category) ? { category: clean(op.category) } : {},
              });
              applied++;
            }
            break;
          case 'hide':
            if (known.has(id)) { await convex.mutation(api.blocks.setVisible, { id: id as never, visible: false }); applied++; }
            break;
          case 'show':
            if (known.has(id)) { await convex.mutation(api.blocks.setVisible, { id: id as never, visible: true }); applied++; }
            break;
          case 'convert':
            if (known.has(id) && isType(op.type)) { await convex.mutation(api.blocks.convertType, { id: id as never, type: op.type }); applied++; }
            break;
          case 'rename':
            if (known.has(id) && clean(op.title)) { await convex.mutation(api.blocks.rename, { id: id as never, title: clean(op.title) }); applied++; }
            break;
          case 'set_category':
            if (known.has(id) && clean(op.category)) { await convex.mutation(api.blocks.updateQueryConfig, { id: id as never, queryConfig: { category: clean(op.category) } }); applied++; }
            break;
          default:
            break;
        }
      } catch {
        // Skip any op that fails ownership/validation; keep applying the rest.
      }
    }

    return NextResponse.json({
      applied,
      note: note || (applied ? `Applied ${applied} change${applied === 1 ? '' : 's'}.` : 'No changes matched that command.'),
    });
  } catch (error) {
    console.error('api/canvas/command error:', error);
    return toErrorResponse(error);
  }
}
