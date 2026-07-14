import { describe, expect, it } from 'vitest';
import { applyCorrections, CORRECTABLE_FIELDS } from '../../utils/api/corrections';
import type { LogEntity } from '../../lib/dashboard-utils';

const AT = '2026-07-12T10:00:00.000Z';
const LATER = '2026-07-12T11:00:00.000Z';

function entity(overrides: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: null,
    amount: 850, currency: 'ZAR', client: 'Acme', project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null,
    sentiment: null, urgency: null, confidence: 0.9,
    ...overrides,
  };
}

describe('CORRECTABLE_FIELDS', () => {
  it('matches PRD Req 19', () => {
    expect(CORRECTABLE_FIELDS).toEqual(['category', 'type', 'status', 'amount', 'date', 'client', 'project', 'task']);
  });
});

describe('applyCorrections', () => {
  it('applies changes and records a per-field audit entry', () => {
    const result = applyCorrections([entity()], 0, { category: 'Operations', amount: 900 }, AT);
    expect(result[0].category).toBe('Operations');
    expect(result[0].amount).toBe(900);
    expect(result[0].corrections).toEqual({
      category: { from: 'Finance', to: 'Operations', at: AT },
      amount: { from: 850, to: 900, at: AT },
    });
  });

  it('does not mutate the input and leaves other entities untouched', () => {
    const original = [entity(), entity({ category: 'Tasks' })];
    const result = applyCorrections(original, 0, { client: 'Zenith' }, AT);
    expect(original[0].client).toBe('Acme');
    expect(original[0].corrections).toBeUndefined();
    expect(result[1]).toBe(original[1]);
  });

  it('preserves the original `from` across repeated corrections', () => {
    const once = applyCorrections([entity()], 0, { amount: 900 }, AT);
    const twice = applyCorrections(once, 0, { amount: 950 }, LATER);
    expect(twice[0].corrections?.amount).toEqual({ from: 850, to: 950, at: LATER });
  });

  it('skips no-op changes without writing an audit entry', () => {
    const result = applyCorrections([entity()], 0, { client: 'Acme' }, AT);
    expect(result[0].corrections).toBeUndefined();
  });

  it('accepts null to clear nullable fields, and normalizes empty strings to null', () => {
    const result = applyCorrections([entity()], 0, { client: '', status: null }, AT);
    expect(result[0].client).toBeNull();
    expect(result[0].corrections?.client).toEqual({ from: 'Acme', to: null, at: AT });
    expect(result[0].corrections?.status).toBeUndefined(); // was already null: no-op
  });

  it('rejects invalid indexes, fields, and values', () => {
    expect(() => applyCorrections([entity()], 1, { amount: 900 }, AT)).toThrow(/entity index/i);
    expect(() => applyCorrections([entity()], -1, { amount: 900 }, AT)).toThrow(/entity index/i);
    expect(() => applyCorrections([entity()], 0, { confidence: 1 }, AT)).toThrow(/not correctable/i);
    expect(() => applyCorrections([entity()], 0, { category: 'Bogus' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { type: 'banana' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { amount: 'lots' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { date: 'sometime' }, AT)).toThrow(/invalid/i);
    expect(() => applyCorrections([entity()], 0, { category: null }, AT)).toThrow(/invalid/i);
  });
});
