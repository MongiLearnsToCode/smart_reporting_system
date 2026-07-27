import { describe, expect, it } from 'vitest';
import {
  buildBriefFacts,
  formatAmount,
  formatTotals,
  activeSections,
  sectionHasSubstance,
} from '../../lib/report-brief';
import type { Log, LogEntity } from '../../lib/dashboard-utils';

function entity(over: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'note',
    category: 'Other',
    date: null,
    date_reference: null,
    amount: null,
    currency: null,
    client: null,
    project: null,
    task: null,
    status: null,
    issue_or_risk: null,
    deliverable: null,
    sentiment: null,
    urgency: null,
    confidence: 0.9,
    ...over,
  };
}

function log(over: Partial<Log> = {}): Log {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    raw_content: 'entry',
    type: 'text',
    category: 'Other',
    entities: [],
    is_conflict: false,
    timestamp: '2026-07-20T10:00:00.000Z',
    ...over,
  };
}

describe('buildBriefFacts', () => {
  it('counts entries, categories and active days', () => {
    const facts = buildBriefFacts([
      log({ category: 'Finance', timestamp: '2026-07-20T10:00:00.000Z' }),
      log({ category: 'Finance', timestamp: '2026-07-20T18:00:00.000Z' }),
      log({ category: 'Tasks', timestamp: '2026-07-21T09:00:00.000Z' }),
    ]);

    expect(facts.entryCount).toBe(3);
    expect(facts.activeDays).toBe(2);
    expect(facts.categories).toEqual([
      { category: 'Finance', count: 2 },
      { category: 'Tasks', count: 1 },
    ]);
  });

  it('excludes logs the user removed from reports', () => {
    const facts = buildBriefFacts([
      log({ category: 'Finance' }),
      log({ category: 'Finance', excluded_from_reports: true }),
    ]);
    expect(facts.entryCount).toBe(1);
  });

  it('totals spend and income separately, grouped by currency', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 300.5, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 900, currency: 'ZAR' })] }),
      log({ entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
    ]);

    expect(facts.spend).toEqual([
      { currency: 'USD', amount: 1500.5 },
      { currency: 'ZAR', amount: 900 },
    ]);
    expect(facts.income).toEqual([{ currency: 'USD', amount: 5000 }]);
    expect(facts.net).toEqual([{ currency: 'USD', amount: 3499.5 }, { currency: 'ZAR', amount: -900 }]);
  });

  it('labels uncurrencied amounts with the account default', () => {
    const facts = buildBriefFacts(
      [log({ entities: [entity({ type: 'expense', amount: 40 })] })],
      'GBP',
    );
    expect(facts.spend).toEqual([{ currency: 'GBP', amount: 40 }]);
  });

  it('treats spend as positive regardless of how it was extracted', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: -250, currency: 'USD' })] }),
    ]);
    expect(facts.spend).toEqual([{ currency: 'USD', amount: 250 }]);
  });

  it('ignores figures on entities that are not transactions', () => {
    // A task carrying a quoted figure is not money that moved.
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'task', amount: 9999, currency: 'USD', status: 'open' })] }),
    ]);
    expect(facts.spend).toEqual([]);
    expect(facts.income).toEqual([]);
    expect(facts.tasks.open).toBe(1);
  });

  it('breaks spend down by category, largest first', () => {
    const facts = buildBriefFacts([
      log({ category: 'Marketing', entities: [entity({ type: 'expense', amount: 200, currency: 'USD' })] }),
      log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 800, currency: 'USD' })] }),
    ]);
    expect(facts.spendByCategory.map((r) => r.category)).toEqual(['Finance', 'Marketing']);
  });

  it('tallies task states and collects the items behind them', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'Logo pack' })] }),
      log({ entities: [entity({ type: 'task', status: 'blocked', task: 'Vendor contract' })] }),
      log({ entities: [entity({ type: 'task', status: 'open', task: 'Draft deck' })] }),
      log({ entities: [entity({ type: 'task', status: 'in_progress', task: 'Site build' })] }),
    ]);

    expect(facts.tasks).toEqual({ completed: 1, inProgress: 1, open: 1, blocked: 1 });
    expect(facts.deliverables).toEqual(['Logo pack']);
    expect(facts.blockedItems).toEqual(['Vendor contract']);
    expect(facts.openItems).toEqual(['Draft deck', 'Site build']);
  });

  it('deduplicates clients and risks case-insensitively', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ client: 'Acme', issue_or_risk: 'Timeline slipping' })] }),
      log({ entities: [entity({ client: 'acme', issue_or_risk: 'timeline slipping' })] }),
    ]);
    expect(facts.clients).toEqual(['Acme']);
    expect(facts.risks).toEqual(['Timeline slipping']);
  });

  it('returns empty facts for no logs', () => {
    const facts = buildBriefFacts([]);
    expect(facts.entryCount).toBe(0);
    expect(activeSections(facts)).toEqual([]);
  });
});

describe('formatAmount', () => {
  it('groups thousands and drops meaningless decimals', () => {
    expect(formatAmount(1500, 'USD')).toBe('USD 1,500');
    expect(formatAmount(1234567, 'ZAR')).toBe('ZAR 1,234,567');
    expect(formatAmount(1500.5, 'USD')).toBe('USD 1,500.50');
    expect(formatAmount(0.5, 'GBP')).toBe('GBP 0.50');
  });

  it('keeps the sign and omits an unknown currency marker', () => {
    expect(formatAmount(-200, 'USD')).toBe('-USD 200');
    expect(formatAmount(200, '—')).toBe('200');
  });

  it('is stable regardless of host locale', () => {
    // Intl output shifts with ICU; this formatter must not.
    expect(formatAmount(1000, 'EUR')).toBe('EUR 1,000');
  });
});

describe('formatTotals', () => {
  it('joins multiple currencies readably', () => {
    expect(formatTotals([{ currency: 'USD', amount: 100 }, { currency: 'ZAR', amount: 50 }]))
      .toBe('USD 100 and ZAR 50');
    expect(formatTotals([])).toBe('nothing');
  });
});

describe('sectionHasSubstance', () => {
  const withMoney = buildBriefFacts([
    log({ entities: [entity({ type: 'expense', amount: 10, currency: 'USD' })] }),
  ]);
  const withTasks = buildBriefFacts([
    log({ entities: [entity({ type: 'task', status: 'open', task: 'Thing' })] }),
  ]);

  it('omits financials when no money moved', () => {
    expect(sectionHasSubstance('financials', withTasks)).toBe(false);
    expect(sectionHasSubstance('financials', withMoney)).toBe(true);
  });

  it('omits next steps when nothing is outstanding', () => {
    expect(sectionHasSubstance('next_steps', withMoney)).toBe(false);
    expect(sectionHasSubstance('next_steps', withTasks)).toBe(true);
  });

  it('orders active sections consistently', () => {
    const both = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 10, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'open', task: 'Thing' })] }),
    ]);
    expect(activeSections(both)).toEqual([
      'executive_summary',
      'progress',
      'financials',
      'next_steps',
    ]);
  });
});
