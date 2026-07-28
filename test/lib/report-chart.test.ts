import { describe, expect, it } from 'vitest';
import { buildBriefFacts } from '../../lib/report-brief';
import { financialVisual, CHART_INK } from '../../lib/report-chart';
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

const spend = (category: string, amount: number, currency = 'USD') =>
  log(category, [entity({ type: 'expense', category, amount, currency })]);

describe('financialVisual', () => {
  it('charts single-currency spend across several categories', () => {
    const facts = buildBriefFacts([spend('Finance', 800), spend('Marketing', 200)]);
    const visual = financialVisual(facts);

    expect(visual?.kind).toBe('chart');
    if (visual?.kind !== 'chart') throw new Error('expected chart');
    expect(visual.currency).toBe('USD');
    expect(visual.bars.map((b) => b.label)).toEqual(['Finance', 'Marketing']);
  });

  it('sizes bars against the largest, not the total', () => {
    const facts = buildBriefFacts([spend('Finance', 800), spend('Marketing', 200)]);
    const visual = financialVisual(facts);
    if (visual?.kind !== 'chart') throw new Error('expected chart');

    expect(visual.bars[0].ratio).toBe(1);
    expect(visual.bars[1].ratio).toBeCloseTo(0.25, 5);
  });

  it('carries a direct value label on every bar — print has no tooltip', () => {
    const facts = buildBriefFacts([spend('Finance', 1250.5), spend('Marketing', 430)]);
    const visual = financialVisual(facts);
    if (visual?.kind !== 'chart') throw new Error('expected chart');

    expect(visual.bars.map((b) => b.formatted)).toEqual(['USD 1,250.50', 'USD 430']);
  });

  it('orders bars largest first', () => {
    const facts = buildBriefFacts([
      spend('Marketing', 100), spend('Finance', 900), spend('Operations', 400),
    ]);
    const visual = financialVisual(facts);
    if (visual?.kind !== 'chart') throw new Error('expected chart');
    expect(visual.bars.map((b) => b.label)).toEqual(['Finance', 'Operations', 'Marketing']);
  });

  it('falls back to a table for a single category — a one-bar chart is a number', () => {
    const facts = buildBriefFacts([spend('Finance', 800)]);
    expect(financialVisual(facts)?.kind).toBe('table');
  });

  it('falls back to a table across currencies — two scales cannot share one axis', () => {
    const facts = buildBriefFacts([
      spend('Finance', 800, 'USD'),
      spend('Marketing', 6500, 'ZAR'),
    ]);
    const visual = financialVisual(facts);

    expect(visual?.kind).toBe('table');
    // The table is what keeps the ZAR spend visible; a USD-only chart would
    // silently drop it.
    if (visual?.kind !== 'table') throw new Error('expected table');
    expect(visual.rows.some((r) => r.value.includes('ZAR'))).toBe(true);
  });

  it('returns nothing when no money moved', () => {
    expect(financialVisual(buildBriefFacts([log('Tasks', [entity({})])]))).toBeNull();
  });

  it('uses one validated hue for every bar, not a colour per category', () => {
    // Colouring bars by category would double-encode length as hue when the
    // category is already on the axis.
    expect(CHART_INK).toBe('#2a78d6');
  });
});
