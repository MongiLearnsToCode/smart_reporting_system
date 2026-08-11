import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq } from '@/utils/api/groq';
import { convexForUser } from '@/utils/convex/serverClient';
import { api } from '@/convex/_generated/api';
import { parseConvexId, DEFAULT_SETTINGS } from '@/utils/api/validation';
import { convexLogToLog, type ConvexLogDoc } from '@/utils/convex/adapters';
import { buildBriefFacts, activeSections, compareFacts } from '@/lib/report-brief';
import { buildSectionPrompt, parseSectionResponse } from '@/lib/report-narrative';
import { assembleBrief } from '@/lib/report-assemble';
import { BUSINESS_SCOPE_LABEL } from '@/lib/dashboard-utils';
import type { SectionId } from '@/lib/report-brief';
import { logError } from '@/utils/logger';

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

    const windowMs = days * 86400000;
    const since = Date.now() - windowMs;
    // The equal-length window immediately before this one. A figure with no
    // prior to sit against is close to unreadable — "spend totalled USD 4,200"
    // says nothing until you know it was USD 6,100 last month.
    const priorSince = since - windowMs;

    // The generated doc type widens entity fields (every one is optional in the
    // validator); the adapter is the boundary that narrows them back.
    const all = docs.map((doc) => convexLogToLog(doc as unknown as ConvexLogDoc));
    const at = (l: { timestamp: string | number | Date }) => new Date(l.timestamp).getTime();
    const logs = all.filter((l) => at(l) >= since);
    const priorLogs = all.filter((l) => at(l) >= priorSince && at(l) < since);

    const stored = user.user_metadata?.settings;
    const settings = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
    const facts = buildBriefFacts(logs, settings.currency);
    const comparison = compareFacts(facts, buildBriefFacts(priorLogs, settings.currency), days);
    const ctx = { scopeLabel, periodLabel: periodLabel(days), comparison };
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
      const parsed = parseSectionResponse(raw, ids);
      if (parsed && typeof parsed === 'object') {
        aiSections = {};
        for (const id of ids) {
          if (typeof parsed[id] === 'string') aiSections[id] = parsed[id];
        }
      }
    } catch (error) {
      logError('api.reports.brief.narration', error);
    }

    const brief = assembleBrief({ title, facts, ctx, aiSections });
    return NextResponse.json({ brief });
  } catch (error) {
    logError('api.reports.brief', error);
    return toErrorResponse(error);
  }
}
