import { describe, expect, it } from 'vitest';
import { buildBriefFacts, compareFacts } from '../../lib/report-brief';
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

  it('keeps a category on one report currency scale', () => {
    const facts = buildBriefFacts([
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 100, currency: 'USD' })] }),
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 50, currency: 'ZAR' })] }),
    ]);
    expect(financialRows(facts)[0].value).toBe('USD 100');
    expect(facts.unconvertedTransactions).toBe(1);
  });

  it('returns nothing when no money moved', () => {
    expect(financialRows(buildBriefFacts([log()]))).toEqual([]);
  });
});

describe('highlightStats', () => {
  it('leads with the outcome, then the workings behind it', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'Logo' })] }),
    ]);

    expect(highlightStats(facts)).toEqual([
      { label: 'Approx. net position', value: 'USD 3,800' },
      { label: 'Approx. income', value: 'USD 5,000' },
      { label: 'Approx. spend', value: 'USD 1,200' },
      { label: 'Delivered', value: '1', detail: 'Logo' },
    ]);
  });

  it('carries direction of travel on money when a prior period exists', () => {
    const current = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 4200, currency: 'USD' })] }),
    ]);
    const previous = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 6100, currency: 'USD' })] }),
    ]);
    // The delta is its own field, not glued onto the value: inside a narrow
    // stat column the combined string wrapped as "USD 4,200 -" / "31%", which
    // reads as a negative amount.
    const stats = highlightStats(current, compareFacts(current, previous, 30));
    const spend = stats.find((s) => s.label === 'Approx. spend')!;
    expect(spend.value).toBe('USD 4,200');
    expect(spend.delta).toBe('-31%');
  });

  it('states a bare figure when there is no prior period to compare against', () => {
    const current = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 4200, currency: 'USD' })] }),
    ]);
    const stats = highlightStats(current, compareFacts(current, buildBriefFacts([]), 30));
    const spend = stats.find((s) => s.label === 'Approx. spend')!;
    expect(spend.value).toBe('USD 4,200');
    expect(spend.delta).toBeUndefined();
  });

  it('uses an ASCII minus, the only one Helvetica will actually print', () => {
    // U+2212 is absent from WinAnsi; react-pdf drops it silently, and "-31%"
    // printed as "31%" turns a fall in spending into what reads as a rise.
    const current = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 4200, currency: 'USD' })] }),
    ]);
    const previous = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 6100, currency: 'USD' })] }),
    ]);
    const delta = highlightStats(current, compareFacts(current, previous, 30))
      .find((s) => s.label === 'Approx. spend')!.delta!;
    expect(delta).toMatch(/^[\x20-\x7e]+$/);
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
    expect(highlightStats(facts)).toContainEqual({ label: 'Outstanding', value: '2', detail: 'A · B' });
  });

  it('uses specific work as context and avoids duplicating delivered work as completed tasks', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'Brand guidelines' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'Design system' })] }),
      log({ entities: [entity({ type: 'task', status: 'blocked', task: 'Printer contract' })] }),
    ]);

    expect(highlightStats(facts)).toEqual([
      { label: 'Delivered', value: '2', detail: 'Brand guidelines · Design system' },
      { label: 'Awaiting decision', value: '1', detail: 'Printer contract' },
    ]);
  });
});
