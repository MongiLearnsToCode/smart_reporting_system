import { describe, expect, it } from 'vitest';
import {
  NEEDS_REVIEW_THRESHOLD, normalizeEntities, overallConfidence, primaryCategory, statusFor,
} from '../../utils/api/entity-normalizer';

describe('normalizeEntities', () => {
  it('normalizes a valid entity array', () => {
    const result = normalizeEntities([
      {
        type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: 'yesterday',
        amount: '850', currency: 'ZAR', client: ' Acme ', project: null, task: null,
        status: null, issue_or_risk: null, deliverable: null,
        sentiment: 'neutral', urgency: 'low', confidence: 0.91,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'expense', category: 'Finance', date: '2026-07-10', date_reference: 'yesterday',
      amount: 850, currency: 'ZAR', client: 'Acme', sentiment: 'neutral', urgency: 'low', confidence: 0.91,
    });
  });

  it('coerces bad enums and clamps confidence', () => {
    const [e] = normalizeEntities([
      { type: 'banana', category: 'Bookkeeping', status: 'done', sentiment: 'meh', urgency: 'ASAP', confidence: 7 },
    ]);
    expect(e.type).toBe('note');
    expect(e.category).toBe('Other');
    expect(e.status).toBeNull();
    expect(e.sentiment).toBeNull();
    expect(e.urgency).toBeNull();
    expect(e.confidence).toBe(1);
  });

  it('nulls unusable amounts and dates', () => {
    const [e] = normalizeEntities([{ amount: 'lots', date: 'sometime', confidence: 0.9 }]);
    expect(e.amount).toBeNull();
    expect(e.date).toBeNull();
  });

  it('unwraps a { entities: [...] } wrapper object', () => {
    const result = normalizeEntities({ entities: [{ type: 'task', category: 'Tasks', confidence: 0.8 }] });
    expect(result[0].type).toBe('task');
  });

  it('falls back to a single low-confidence note for garbage', () => {
    for (const garbage of [null, 'text', 42, {}, []]) {
      const result = normalizeEntities(garbage);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('note');
      expect(result[0].category).toBe('Other');
      expect(result[0].confidence).toBeLessThan(NEEDS_REVIEW_THRESHOLD);
    }
  });

  it('caps entity count at 20', () => {
    const many = Array.from({ length: 30 }, () => ({ type: 'note', category: 'Other', confidence: 0.9 }));
    expect(normalizeEntities(many)).toHaveLength(20);
  });
});

describe('confidence helpers', () => {
  const entities = normalizeEntities([
    { type: 'expense', category: 'Finance', confidence: 0.95 },
    { type: 'task', category: 'Tasks', confidence: 0.7 },
  ]);

  it('overallConfidence is the minimum', () => {
    expect(overallConfidence(entities)).toBe(0.7);
  });

  it('primaryCategory follows the highest-confidence entity', () => {
    expect(primaryCategory(entities)).toBe('Finance');
    expect(primaryCategory([])).toBe('Other');
  });

  it('statusFor applies the 0.75 threshold', () => {
    expect(statusFor(0.74)).toBe('needs_review');
    expect(statusFor(0.75)).toBe('processed');
  });
});
