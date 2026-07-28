// End-to-end over the pure pipeline: logs → facts → brief → PDF input.
// Renders nothing, but proves the document a user would receive is coherent,
// free of filler, and states no figure the logs don't support.

import { describe, expect, it } from 'vitest';
import { buildBriefFacts } from '../../lib/report-brief';
import { assembleBrief, collectAllowedNumbers, hasUnsupportedFigures } from '../../lib/report-assemble';
import { financialRows, highlightStats } from '../../lib/report-tables';
import { hasFiller, splitSentences, wordCount } from '../../lib/report-prose';
import type { Log, LogEntity } from '../../lib/dashboard-utils';

function entity(over: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'note', category: 'Other', date: null, date_reference: null,
    amount: null, currency: null, client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null, sentiment: null,
    urgency: null, confidence: 0.9, ...over,
  };
}

function log(category: string, entities: LogEntity[], day = 20): Log {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    raw_content: 'entry',
    type: 'text',
    category,
    entities,
    is_conflict: false,
    timestamp: `2026-07-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  };
}

// A realistic week for a consultancy: spend, income, delivery, a blocker.
const WEEK: Log[] = [
  log('Finance', [entity({ type: 'expense', amount: 1250.75, currency: 'USD', client: 'Acme' })], 20),
  log('Finance', [entity({ type: 'income', amount: 8000, currency: 'USD', client: 'Acme' })], 21),
  log('Marketing', [entity({ type: 'expense', amount: 430, currency: 'USD' })], 21),
  log('Tasks', [entity({ type: 'task', status: 'complete', deliverable: 'Brand guidelines' })], 22),
  log('Tasks', [entity({ type: 'task', status: 'complete', deliverable: 'Launch deck' })], 22),
  log('Tasks', [entity({ type: 'task', status: 'blocked', task: 'Printer contract', issue_or_risk: 'Vendor unresponsive' })], 23),
  log('Clients', [entity({ type: 'client_update', client: 'Northwind', status: 'in_progress', task: 'Discovery workshop' })], 23),
];

const ctx = { scopeLabel: 'Acme Rebrand', periodLabel: 'This week' };

describe('report pipeline', () => {
  const facts = buildBriefFacts(WEEK);
  const brief = assembleBrief({ title: 'Weekly progress', facts, ctx, aiSections: null });

  it('produces the executive-brief sections in order, ending on the ask', () => {
    expect(brief.sections.map((s) => s.title)).toEqual([
      'Executive Summary',
      'Progress',
      'Financials',
      'Next Steps',
      'Needs Your Decision',
    ]);
  });

  it('states no figure the logs do not support', () => {
    const allowed = collectAllowedNumbers(facts, ctx);
    for (const section of brief.sections) {
      expect(hasUnsupportedFigures(section.body, allowed)).toBe(false);
    }
  });

  it('carries no filler anywhere in the document', () => {
    for (const section of brief.sections) {
      expect(hasFiller(section.body)).toBe(false);
    }
  });

  it('keeps every section to succinct prose, not an essay', () => {
    for (const section of brief.sections) {
      const sentences = splitSentences(section.body);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(4);
      // Complete sentences, but tight: a section that runs long has stopped
      // being an executive brief.
      expect(wordCount(section.body)).toBeLessThanOrEqual(80);
    }
  });

  it('writes in complete sentences', () => {
    for (const section of brief.sections) {
      expect(section.body.trim()).toMatch(/^[A-Z(“"']/);
      expect(section.body.trim()).toMatch(/[.!?]$/);
    }
  });

  it('reports the real money, netted across the period', () => {
    const financials = brief.sections.find((s) => s.title === 'Financials')!;
    expect(financials.body).toContain('USD 1,680.75'); // 1250.75 + 430
    expect(financials.body).toContain('USD 8,000');
    expect(financials.body).toContain('USD 6,319.25'); // net
  });

  it('names what shipped, and separates what we will do from what they must', () => {
    const progress = brief.sections.find((s) => s.title === 'Progress')!;
    expect(progress.body).toContain('Brand guidelines');

    const next = brief.sections.find((s) => s.title === 'Next Steps')!;
    expect(next.body).toContain('Vendor unresponsive');
    expect(next.body).not.toContain('Printer contract');

    // The blocker becomes an ask, listed verbatim rather than buried in prose.
    const decisions = brief.sections.find((s) => s.title === 'Needs Your Decision')!;
    expect(decisions.items).toContain('Printer contract');
    expect(decisions.source).toBe('facts');
  });

  it('never lets the model write the asks, however good its prose', () => {
    // A blocker restated more diplomatically stops being a blocker.
    const hijacked = assembleBrief({
      title: 'Weekly progress',
      facts,
      ctx,
      aiSections: { decisions: 'Everything is progressing smoothly and no action is required.' },
    });
    const decisions = hijacked.sections.find((s) => s.title === 'Needs Your Decision')!;
    expect(decisions.source).toBe('facts');
    expect(decisions.body).not.toContain('smoothly');
  });

  it('builds a financial table that reconciles with the prose', () => {
    const rows = financialRows(facts);
    expect(rows).toEqual([
      { label: 'Finance', value: 'USD 1,250.75' },
      { label: 'Marketing', value: 'USD 430' },
      { label: 'Total spend', value: 'USD 1,680.75' },
    ]);
  });

  it('builds a stat strip within the four-item cap', () => {
    const stats = highlightStats(facts);
    expect(stats.length).toBeLessThanOrEqual(4);
    // Whether the period paid for itself, before the workings that got there.
    expect(stats[0]).toEqual({ label: 'Net position', value: 'USD 6,319.25' });
  });

  it('still produces a full document when the model supplies prose', () => {
    const withAi = assembleBrief({
      title: 'Weekly progress',
      facts,
      ctx,
      aiSections: {
        executive_summary:
          'Acme Rebrand closed the week with USD 8,000 booked against USD 1,680.75 of spend. Two items shipped and one is blocked.',
      },
    });
    const summary = withAi.sections.find((s) => s.id === 'executive_summary')!;
    expect(summary.source).toBe('ai');
    expect(hasFiller(summary.body)).toBe(false);
    expect(
      hasUnsupportedFigures(summary.body, collectAllowedNumbers(facts, ctx)),
    ).toBe(false);
  });

  it('degrades to a valid document when there is almost nothing to report', () => {
    const sparse = buildBriefFacts([log('Operations', [entity({})])]);
    const thin = assembleBrief({ title: 'Weekly progress', facts: sparse, ctx });
    expect(thin.sections.length).toBeGreaterThan(0);
    for (const section of thin.sections) {
      expect(section.body.trim().length).toBeGreaterThan(0);
      expect(hasFiller(section.body)).toBe(false);
    }
  });
});
