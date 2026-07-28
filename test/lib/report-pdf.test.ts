// Renders the PDF for real. The document model is covered elsewhere; this
// guards the layer that no other test touches — a bad style value, a removed
// import or an invalid dimension throws here rather than in a client's export.
import { describe, expect, it } from 'vitest';
import { buildBriefFacts } from '../../lib/report-brief';
import { assembleBrief } from '../../lib/report-assemble';
import { highlightStats } from '../../lib/report-tables';
import { financialVisual } from '../../lib/report-chart';
import { buildReportPdf } from '../../utils/report-pdf';
import type { Log, LogEntity } from '../../lib/dashboard-utils';

function entity(over: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'note', category: 'Other', date: null, date_reference: null,
    amount: null, currency: null, client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null, sentiment: null,
    urgency: null, confidence: 0.9, ...over,
  };
}
function log(category: string, entities: LogEntity[]): Log {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', raw_content: 'x',
    type: 'text', category, entities, is_conflict: false,
    timestamp: '2026-07-20T10:00:00.000Z',
  };
}

const WORK: Log[] = [
  log('Finance', [entity({ type: 'expense', category: 'Finance', amount: 17194.75, currency: 'USD' })]),
  log('Operations', [entity({ type: 'expense', category: 'Operations', amount: 1180, currency: 'USD' })]),
  log('Marketing', [entity({ type: 'expense', category: 'Marketing', amount: 430, currency: 'USD' })]),
  log('Finance', [entity({ type: 'income', category: 'Finance', amount: 11500, currency: 'USD' })]),
  log('Tasks', [entity({ type: 'task', category: 'Tasks', status: 'complete', deliverable: 'Brand guidelines' })]),
  log('Tasks', [entity({ type: 'task', category: 'Tasks', status: 'blocked', task: 'Printer contract', issue_or_risk: 'Vendor unresponsive' })]),
];

async function render(logs: Log[]) {
  const facts = buildBriefFacts(logs, 'USD');
  const ctx = { scopeLabel: 'Entire business', periodLabel: 'This month' };
  const brief = assembleBrief({ title: 'Progress report', facts, ctx });
  const blob = await buildReportPdf({
    title: brief.title,
    scopeLabel: brief.scopeLabel,
    periodLabel: brief.periodLabel,
    generatedAt: '28 July 2026',
    sections: brief.sections.map((s) => ({ title: s.title, body: s.body, items: s.items })),
    stats: highlightStats(facts),
    financials: financialVisual(facts),
  });
  return Buffer.from(await blob.arrayBuffer());
}

describe('buildReportPdf', () => {
  it('renders a valid PDF for the bar-chart path', async () => {
    const pdf = await render(WORK);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30000);

  it('renders a valid PDF for the multi-currency table path', async () => {
    const pdf = await render([
      ...WORK,
      log('Marketing', [entity({ type: 'expense', category: 'Marketing', amount: 6500, currency: 'ZAR' })]),
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30000);

  it('renders when there is nothing to chart or tabulate', async () => {
    const pdf = await render([log('Tasks', [entity({ type: 'task', status: 'open', task: 'Draft' })])]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('renders the asks list without spilling the call to action onto a second page', async () => {
    // The decisions section is last and must stay with the rest of the brief:
    // a one-page report whose only actionable part sits alone on page two has
    // buried it. Rendering is the only way to catch this — it is a layout
    // outcome, not a value any unit test can assert.
    const pdf = await render([
      ...WORK,
      log('Projects', [entity({ type: 'task', status: 'blocked', task: 'Printer contract, vendor gone quiet' })]),
      log('Tasks', [entity({ type: 'task', status: 'blocked', task: 'Website copy deck, waiting on the founder interview' })]),
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // /Type /Page appears once per page (plus /Pages for the tree).
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBe(1);
  }, 30000);
});
