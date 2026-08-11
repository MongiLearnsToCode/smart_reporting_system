import { describe, expect, it } from 'vitest';
import {
  buildBriefFacts,
  formatAmount,
  formatTotals,
  activeSections,
  sectionHasSubstance,
  compareFacts,
  changePhrase,
  isBriefFacts,
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

  it('totals financials in the report currency and discloses missing conversions', () => {
    const facts = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 300.5, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'expense', amount: 900, currency: 'ZAR' })] }),
      log({ entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
    ]);

    expect(facts.spend).toEqual([{ currency: 'USD', amount: 1500.5 }]);
    expect(facts.income).toEqual([{ currency: 'USD', amount: 5000 }]);
    expect(facts.net).toEqual([{ currency: 'USD', amount: 3499.5 }]);
    expect(facts.unconvertedTransactions).toBe(1);
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

describe('compareFacts', () => {
  const spend = (amount: number, currency = 'USD') =>
    log({ entities: [entity({ type: 'expense', amount, currency })] });

  it('reports the change against the equal-length window before it', () => {
    const cmp = compareFacts(
      buildBriefFacts([spend(4200)]),
      buildBriefFacts([spend(6100)]),
      30,
    );
    expect(cmp.spend).toEqual([
      { currency: 'USD', current: 4200, previous: 6100, changePct: -31 },
    ]);
    expect(cmp.windowDays).toBe(30);
    expect(cmp.priorEmpty).toBe(false);
  });

  it('calls a currency new rather than up an infinite percentage', () => {
    // Dividing by a previous total of zero is not a percentage, and printing
    // one would be the sort of nonsense figure that discredits a whole report.
    const cmp = compareFacts(buildBriefFacts([spend(4200)]), buildBriefFacts([]), 30);
    expect(cmp.spend[0].changePct).toBeNull();
    expect(cmp.priorEmpty).toBe(true);
  });

  it('ignores a currency that only appears in the earlier window', () => {
    // A report is about the period it covers. "ZAR spend is down 100%" when no
    // rands were spent this month is noise, not insight.
    const cmp = compareFacts(
      buildBriefFacts([spend(4200)]),
      buildBriefFacts([spend(4200), spend(6500, 'ZAR')]),
      30,
    );
    expect(cmp.spend.map((d) => d.currency)).toEqual(['USD']);
  });

  it('tracks completions as a count, not a percentage', () => {
    const done = (n: number) =>
      buildBriefFacts(
        Array.from({ length: n }, (_, i) =>
          log({ entities: [entity({ type: 'task', status: 'complete', deliverable: `D${i}` })] })),
      );
    expect(compareFacts(done(5), done(2), 7).completed).toEqual({
      current: 5, previous: 2, change: 3,
    });
  });
});

describe('changePhrase', () => {
  it('reads as something a sentence can absorb', () => {
    expect(changePhrase(-31)).toBe('down 31% from');
    expect(changePhrase(12)).toBe('up 12% from');
    expect(changePhrase(0)).toBe('level with');
  });

  it('says nothing when there is nothing to compare against', () => {
    expect(changePhrase(null)).toBeNull();
  });
});

describe('isBriefFacts', () => {
  const facts = buildBriefFacts([
    log({ entities: [entity({ type: 'expense', amount: 10, currency: 'USD' })] }),
  ]);

  it('accepts what buildBriefFacts produces', () => {
    // Round-tripped through JSON, which is how a stored draft comes back.
    expect(isBriefFacts(JSON.parse(JSON.stringify(facts)))).toBe(true);
  });

  it('rejects a draft written before a field the export path indexes into existed', () => {
    // The case this exists for: BriefFacts grows, a draft saved under the old
    // shape is reopened, and highlightStats does facts.income.length on
    // undefined. Better to lose the stat strip than the whole export.
    const { spendByCategory, ...older } = JSON.parse(JSON.stringify(facts));
    expect(isBriefFacts(older)).toBe(false);

    const noTasks = JSON.parse(JSON.stringify(facts));
    delete noTasks.tasks;
    expect(isBriefFacts(noTasks)).toBe(false);
  });

  it('rejects money that is not money', () => {
    const bad = JSON.parse(JSON.stringify(facts));
    bad.spend = [{ currency: 'USD', amount: 'lots' }];
    expect(isBriefFacts(bad)).toBe(false);
  });

  it('rejects anything that is not an object at all', () => {
    for (const value of [null, undefined, 'facts', 42, []]) {
      expect(isBriefFacts(value)).toBe(false);
    }
  });

  it('tolerates fields it does not know about, so a newer draft still renders', () => {
    // Forward compatibility matters as much as backward: a draft written by a
    // build that added a fact should not be rejected by one that hasn't.
    const newer = { ...JSON.parse(JSON.stringify(facts)), somethingAddedLater: [1, 2] };
    expect(isBriefFacts(newer)).toBe(true);
  });
});
