import { describe, expect, it } from 'vitest';
import { buildBriefFacts } from '../../lib/report-brief';
import { financialRows, highlightStats } from '../../lib/report-tables';
import type { Log, LogEntity } from '../../lib/dashboard-utils';

function entity(over: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'note', category: 'Other', date: null, date_reference: null,
    amount: null, currency: null, client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null, sentiment: null,
    urgency: null, confidence: 0.9, ...over,
  };
}

function log(over: Partial<Log> = {}): Log {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1', raw_content: 'entry', type: 'text', category: 'Other',
    entities: [], is_conflict: false, timestamp: '2026-07-20T10:00:00.000Z', ...over,
  };
}

describe('financialRows', () => {
  it('lists spend by category, largest first, with a total', () => {
    const facts = buildBriefFacts([
      log({ category: 'Marketing', entities: [entity({ type: 'expense', amount: 200, currency: 'USD' })] }),
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 800, currency: 'USD' })] }),
    ]);

    expect(financialRows(facts)).toEqual([
      { label: 'Finance', value: 'USD 800' },
      { label: 'Marketing', value: 'USD 200' },
      { label: 'Total spend', value: 'USD 1,000' },
    ]);
  });

  it('omits the total when one category already is the total', () => {
    const facts = buildBriefFacts([
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 800, currency: 'USD' })] }),
    ]);
    expect(financialRows(facts)).toEqual([{ label: 'Finance', value: 'USD 800' }]);
  });

  it('shows multiple currencies within a category', () => {
    const facts = buildBriefFacts([
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 100, currency: 'USD' })] }),
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 50, currency: 'ZAR' })] }),
    ]);
    expect(financialRows(facts)[0].value).toBe('USD 100 · ZAR 50');
  });

  it('returns nothing when no money moved', () => {
    expect(financialRows(buildBriefFacts([log()]))).toEqual([]);
  });
});

describe('highlightStats', () => {
  it('leads with money, then delivery', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'Logo' })] }),
    ]);

    expect(highlightStats(facts)).toEqual([
      { label: 'Income', value: 'USD 5,000' },
      { label: 'Spend', value: 'USD 1,200' },
      { label: 'Completed', value: '1' },
    ]);
  });

  it('never exceeds four stats — beyond that it stops being a glance', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'income', amount: 1, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 1, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'A' })] }),
      log({ entities: [entity({ type: 'task', status: 'open', task: 'B' })] }),
      log({ entities: [entity({ type: 'task', status: 'blocked', task: 'C' })] }),
      log({ entities: [entity({ client: 'Acme' })] }),
    ]);
    expect(highlightStats(facts).length).toBe(4);
  });

  it('always returns at least one stat', () => {
    const stats = highlightStats(buildBriefFacts([log(), log()]));
    expect(stats).toEqual([{ label: 'Entries', value: '2' }]);
  });

  it('reports outstanding work when nothing completed', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'task', status: 'open', task: 'A' })] }),
      log({ entities: [entity({ type: 'task', status: 'in_progress', task: 'B' })] }),
    ]);
    expect(highlightStats(facts)).toContainEqual({ label: 'Outstanding', value: '2' });
  });
});
