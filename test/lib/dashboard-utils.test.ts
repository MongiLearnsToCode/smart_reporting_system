import { describe, expect, it } from 'vitest';
import {
  entitiesOf, logAmount, logClients, logSentiment, logUrgency,
  primaryEntity, uniqueClients, type Log, type LogEntity,
} from '../../lib/dashboard-utils';

function log(overrides: Partial<Log>): Log {
  return {
    id: 'id',
    user_id: 'u',
    raw_content: 'content',
    type: 'text',
    category: 'general',
    is_conflict: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function entity(overrides: Partial<LogEntity>): LogEntity {
  return {
    type: 'note', category: 'Other', date: null, date_reference: null,
    amount: null, currency: null, client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null,
    sentiment: null, urgency: null, confidence: 0.9,
    ...overrides,
  };
}

describe('uniqueClients', () => {
  it('returns distinct trimmed client names in first-seen order', () => {
    const logs = [
      log({ entities: { client: 'Meridian Corp' } }),
      log({ entities: { client: '  Acme Studios ' } }),
      log({ entities: { client: 'Meridian Corp' } }),
    ];
    expect(uniqueClients(logs)).toEqual(['Meridian Corp', 'Acme Studios']);
  });

  it('ignores logs without a usable client', () => {
    const logs = [
      log({}),
      log({ entities: {} }),
      log({ entities: { client: null } }),
      log({ entities: { client: '   ' } }),
    ];
    expect(uniqueClients(logs)).toEqual([]);
    expect(uniqueClients([])).toEqual([]);
  });
});

describe('entitiesOf', () => {
  it('returns entity arrays as-is', () => {
    const e = [entity({ type: 'expense' })];
    expect(entitiesOf(log({ entities: e }))).toBe(e);
  });

  it('wraps a legacy single object, inferring type from amount', () => {
    const wrapped = entitiesOf(log({ category: 'Finance', entities: { amount: 50, currency: 'ZAR', client: 'Acme' } as never }));
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]).toMatchObject({ type: 'expense', category: 'Finance', amount: 50, currency: 'ZAR', client: 'Acme', confidence: 0.8 });
    const note = entitiesOf(log({ category: 'Tasks', entities: { sentiment: 'positive' } as never }));
    expect(note[0].type).toBe('note');
  });

  it('returns [] for missing or empty entities', () => {
    expect(entitiesOf(log({}))).toEqual([]);
    expect(entitiesOf(log({ entities: {} as never }))).toEqual([]);
    expect(entitiesOf(log({ entities: [] }))).toEqual([]);
  });
});

describe('primaryEntity', () => {
  it('returns the highest-confidence entity', () => {
    const l = log({ entities: [entity({ confidence: 0.6, category: 'Tasks' }), entity({ confidence: 0.95, category: 'Finance' })] });
    expect(primaryEntity(l)?.category).toBe('Finance');
  });

  it('returns null when there are no entities', () => {
    expect(primaryEntity(log({}))).toBeNull();
  });
});

describe('log accessors', () => {
  it('logClients dedupes trimmed clients across entities', () => {
    const l = log({ entities: [entity({ client: ' Acme ' }), entity({ client: 'Acme' }), entity({ client: 'Zenith' }), entity({})] });
    expect(logClients(l)).toEqual(['Acme', 'Zenith']);
  });

  it('logAmount only ever adds amounts that share a currency', () => {
    // 100 ZAR and an unlabelled 50 are not 150 of anything. Without a base
    // currency to convert through, the unlabelled amount is left out and
    // `partial` says so.
    const l = log({ entities: [entity({ amount: 100, currency: 'ZAR' }), entity({ amount: 50 }), entity({})] });
    expect(logAmount(l)).toEqual({ amount: 100, currency: 'ZAR', partial: true });
    expect(logAmount(log({ entities: [entity({})] }))).toBeNull();
  });

  it('logAmount totals across currencies once each amount has been converted', () => {
    const l = log({
      entities: [
        entity({ amount: 512, currency: 'USD' }),
        entity({
          amount: 6500, currency: 'ZAR',
          base_amount: 397.02, base_currency: 'USD', fx_rate: 0.06108, fx_date: '2026-07-09',
        }),
      ],
    });
    expect(logAmount(l, 'USD')).toEqual({ amount: 909.02, currency: 'USD', partial: false });
  });

  it('logAmount leaves out an amount no rate was found for, rather than adding unlike units', () => {
    const l = log({
      entities: [entity({ amount: 512, currency: 'USD' }), entity({ amount: 6500, currency: 'ZAR' })],
    });
    expect(logAmount(l, 'USD')).toEqual({ amount: 512, currency: 'USD', partial: true });
  });

  it('logSentiment/logUrgency read the primary entity', () => {
    const l = log({ entities: [entity({ confidence: 0.5, sentiment: 'negative', urgency: 'high' }), entity({ confidence: 0.9, sentiment: 'positive', urgency: 'low' })] });
    expect(logSentiment(l)).toBe('positive');
    expect(logUrgency(l)).toBe('low');
  });
});

describe('uniqueClients (entity arrays)', () => {
  it('collects clients from entity arrays and legacy objects', () => {
    const logs = [
      log({ entities: [entity({ client: 'Meridian Corp' })] }),
      log({ entities: { client: '  Acme Studios ' } as never }),
      log({ entities: [entity({ client: 'Meridian Corp' })] }),
    ];
    expect(uniqueClients(logs)).toEqual(['Meridian Corp', 'Acme Studios']);
  });
});
