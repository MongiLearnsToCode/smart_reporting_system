import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, getClientIp, rateLimit, requireCsrf, toErrorResponse } from '@/utils/api/guards';
import { callGroq, extractJson } from '@/utils/api/groq';
import { safeFilenamePart } from '@/utils/api/html';
import { parseReportPayload } from '@/utils/api/validation';
import { normalizeReportSections, renderReportHtml } from '@/utils/api/report-html';

const BUCKET = 'uploads';
const SIGNED_URL_TTL = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireCsrf(request);
    await rateLimit(`reports:${getClientIp(request)}`, { limit: 5, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { days, client } = parseReportPayload(await request.json());
    const since = new Date(Date.now() - days * 86400000).toISOString();

    let query = admin
      .from('logs')
      .select('raw_content, category, entities, timestamp')
      .eq('user_id', user.id)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (client) query = query.eq('entities->>client', client);

    const { data: logs, error } = await query;
    if (error) throw error;
    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { error: client ? `No logs for ${client} in this period` : 'No logs in this period' },
        { status: 422 },
      );
    }

    const reportPrompt = [
      'You write client-facing progress reports for a consultant/agency. Return ONLY valid JSON, no markdown.',
      client
        ? `The report is for the client "${client}". Address their work only.`
        : 'The report covers all business activity across clients.',
      'Professional, concrete, first-person-plural ("we") tone. No filler. Never invent facts not present in the logs.',
      'Structure: {"summary": "3-5 sentence executive summary", "highlights": [{"category": "string", "items": ["completed work / notable events as short sentences"]}], "financials": {"total": number or null, "currency": "string or null", "note": "one-sentence money summary or null"}, "next_steps": ["actionable follow-ups implied by the logs"]}',
      'For financials.total, sum only amounts present in log entities.',
    ].join('\n');

    const aiResponse = await callGroq([
      { role: 'system', content: reportPrompt },
      { role: 'user', content: JSON.stringify(logs) },
    ]);

    const sections = normalizeReportSections(extractJson(aiResponse));
    const html = renderReportHtml({ client, days, sections });

    const name = `${Date.now()}-${safeFilenamePart(client || 'all-clients')}-${days}d.html`;
    const path = `${user.id}/reports/${name}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, new Blob([html], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) throw signError ?? new Error('Could not create share link');

    return NextResponse.json({
      report: { name, path, url: signed.signedUrl, client, days, created_at: new Date().toISOString() },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await rateLimit(`reports-list:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: files, error } = await admin.storage
      .from(BUCKET)
      .list(`${user.id}/reports`, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;

    const reports = await Promise.all(
      (files ?? [])
        .filter((f) => f.name.endsWith('.html'))
        .map(async (f) => {
          const path = `${user.id}/reports/${f.name}`;
          const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
          return {
            name: f.name,
            path,
            url: signed?.signedUrl ?? null,
            created_at: f.created_at ?? null,
          };
        }),
    );

    return NextResponse.json({ reports });
  } catch (error) {
    return toErrorResponse(error);
  }
}
