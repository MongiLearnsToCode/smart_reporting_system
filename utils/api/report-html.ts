import { escapeHtml } from '@/utils/api/html';

export type ReportSections = {
  summary: string;
  highlights: Array<{ category: string; items: string[] }>;
  financials: { total: number | null; currency: string | null; note: string | null };
  next_steps: string[];
};

/** Coerce untrusted AI output into a well-formed ReportSections. */
export function normalizeReportSections(input: unknown): ReportSections {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};

  const summary = typeof body.summary === 'string' && body.summary.trim()
    ? body.summary.trim().slice(0, 2000)
    : 'No summary available for this period.';

  const highlights = Array.isArray(body.highlights)
    ? body.highlights
        .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
        .map((h) => ({
          category: typeof h.category === 'string' ? h.category.slice(0, 60) : 'General',
          items: Array.isArray(h.items)
            ? h.items.filter((i): i is string => typeof i === 'string').map((i) => i.slice(0, 400)).slice(0, 10)
            : [],
        }))
        .filter((h) => h.items.length > 0)
        .slice(0, 8)
    : [];

  const fin = body.financials && typeof body.financials === 'object'
    ? body.financials as Record<string, unknown>
    : {};
  const financials = {
    total: typeof fin.total === 'number' && Number.isFinite(fin.total) ? fin.total : null,
    currency: typeof fin.currency === 'string' ? fin.currency.slice(0, 8) : null,
    note: typeof fin.note === 'string' ? fin.note.slice(0, 600) : null,
  };

  const next_steps = Array.isArray(body.next_steps)
    ? body.next_steps.filter((s): s is string => typeof s === 'string').map((s) => s.slice(0, 300)).slice(0, 10)
    : [];

  return { summary, highlights, financials, next_steps };
}

export function renderReportHtml(opts: {
  client: string | null;
  days: number;
  sections: ReportSections;
  generatedAt?: Date;
}): string {
  const { client, days, sections } = opts;
  const generatedAt = opts.generatedAt ?? new Date();
  const title = client ? `Client Report — ${client}` : 'Business Report — All Clients';
  const period = days === 7 ? 'the past week' : days === 30 ? 'the past month' : `the past ${days} days`;

  const highlightsHtml = sections.highlights.length
    ? sections.highlights.map((h) => `
        <h3 style="margin:24px 0 8px;font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#52525b;">${escapeHtml(h.category)}</h3>
        <ul style="margin:0;padding-left:20px;">
          ${h.items.map((i) => `<li style="margin:6px 0;line-height:1.6;">${escapeHtml(i)}</li>`).join('')}
        </ul>`).join('')
    : '<p style="color:#71717a;">No highlights recorded for this period.</p>';

  const financialsHtml = sections.financials.total != null || sections.financials.note
    ? `
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px;margin:28px 0;">
        <h2 style="margin:0 0 8px;font-size:16px;">Financial Summary</h2>
        ${sections.financials.total != null
          ? `<p style="font-size:24px;font-weight:700;margin:4px 0;">${escapeHtml(sections.financials.currency || '')} ${escapeHtml(sections.financials.total.toLocaleString('en-US'))}</p>`
          : ''}
        ${sections.financials.note ? `<p style="color:#52525b;margin:4px 0 0;line-height:1.6;">${escapeHtml(sections.financials.note)}</p>` : ''}
      </div>`
    : '';

  const nextStepsHtml = sections.next_steps.length
    ? `
      <h2 style="font-size:18px;margin:32px 0 8px;">Next Steps</h2>
      <ol style="margin:0;padding-left:20px;">
        ${sections.next_steps.map((s) => `<li style="margin:8px 0;line-height:1.6;">${escapeHtml(s)}</li>`).join('')}
      </ol>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;padding:48px 44px;">
    <div style="border-bottom:2px solid #18181b;padding-bottom:16px;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#71717a;">Codex · Client Report</p>
      <h1 style="margin:0;font-size:26px;letter-spacing:-.01em;">${escapeHtml(title)}</h1>
      <p style="margin:8px 0 0;color:#52525b;font-size:13px;">
        Covering ${escapeHtml(period)} · Generated ${escapeHtml(generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}
      </p>
    </div>

    <h2 style="font-size:18px;margin:0 0 8px;">Summary</h2>
    <p style="line-height:1.7;color:#3f3f46;margin:0;">${escapeHtml(sections.summary)}</p>

    ${financialsHtml}

    <h2 style="font-size:18px;margin:32px 0 4px;">Work Highlights</h2>
    ${highlightsHtml}

    ${nextStepsHtml}

    <div style="margin-top:48px;border-top:1px solid #e4e4e7;padding-top:16px;font-size:11px;color:#a1a1aa;">
      Prepared with Codex — daily logs into client reports.
    </div>
  </div>
</body>
</html>`;
}
