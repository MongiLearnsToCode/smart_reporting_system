import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson } from '@/utils/api/groq';
import { convexForUser } from '@/utils/convex/serverClient';
import { api } from '@/convex/_generated/api';
import { parseConvexId, DEFAULT_SETTINGS } from '@/utils/api/validation';
import { convexLogToLog, type ConvexLogDoc } from '@/utils/convex/adapters';
import { buildBriefFacts, activeSections } from '@/lib/report-brief';
import { buildSectionPrompt } from '@/lib/report-narrative';
import { assembleBrief } from '@/lib/report-assemble';
import { BUSINESS_SCOPE_LABEL } from '@/lib/dashboard-utils';
import type { SectionId } from '@/lib/report-brief';

const MAX_DAYS = 365;

function periodLabel(days: number) {
  if (days === 7) return 'This week';
  if (days === 30) return 'This month';
  if (days === 90) return 'Quarter';
  return `Last ${days} days`;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`brief:${getClientIp(request)}`, { limit: 10, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(Number(body?.days) || 7)));
    const projectId = parseConvexId(body?.projectId);
    const title = typeof body?.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : 'Progress report';

    const convex = convexForUser(session.access_token);
    const docs = await convex.query(
      api.logs.list,
      projectId ? { projectId: projectId as never } : {},
    );

    // Scope label has to match what the canvas showed, so the document says
    // which slice of the business it covers.
    let scopeLabel = BUSINESS_SCOPE_LABEL;
    if (projectId) {
      const projects = await convex.query(api.projects.list, {});
      const match = projects.find((p) => p._id === projectId);
      if (!match) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      scopeLabel = match.name;
    }

    const since = Date.now() - days * 86400000;
    // The generated doc type widens entity fields (every one is optional in the
    // validator); the adapter is the boundary that narrows them back.
    const logs = docs
      .map((doc) => convexLogToLog(doc as unknown as ConvexLogDoc))
      .filter((l) => new Date(l.timestamp).getTime() >= since);

    const stored = user.user_metadata?.settings;
    const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
    const facts = buildBriefFacts(logs, settings.currency);
    const ctx = { scopeLabel, periodLabel: periodLabel(days) };
    const ids = activeSections(facts);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: `No entries for ${scopeLabel} in ${periodLabel(days).toLowerCase()}` },
        { status: 422 },
      );
    }

    // The model only rewrites facts into prose. If it fails, is slow, or returns
    // something unusable, assembleBrief falls back to the deterministic
    // narrative — generating a report must never depend on the provider.
    let aiSections: Partial<Record<SectionId, string>> | null = null;
    try {
      const { system, user: payload } = buildSectionPrompt(ids, facts, ctx);
      const raw = await callGroq([
        { role: 'system', content: system },
        { role: 'user', content: payload },
      ]);
      const parsed = extractJson(raw);
      if (parsed && typeof parsed === 'object') {
        aiSections = {};
        for (const id of ids) {
          if (typeof parsed[id] === 'string') aiSections[id] = parsed[id];
        }
      }
    } catch (error) {
      console.error('api/reports/brief narration failed:', error);
    }

    const brief = assembleBrief({ title, facts, ctx, aiSections });
    return NextResponse.json({ brief });
  } catch (error) {
    console.error('api/reports/brief error:', error);
    return toErrorResponse(error);
  }
}
