import { describe, expect, it } from 'vitest';
import {
  normalizeTier, productKeyFor, statusEntitles, tierAllows, tierForProductKey,
} from '../../lib/tiers';

describe('tierForProductKey', () => {
  it('maps both intervals of a plan to the same tier', () => {
    // The cadence is a billing detail; it must never change what someone can do.
    expect(tierForProductKey('proMonthly')).toBe('pro');
    expect(tierForProductKey('proYearly')).toBe('pro');
    expect(tierForProductKey('starterMonthly')).toBe('starter');
    expect(tierForProductKey('starterYearly')).toBe('starter');
  });

  it('falls back to free for a product the code does not know', () => {
    // A product added in the Polar dashboard before the code knows about it
    // must not grant the top tier by accident. Free is the safe direction.
    expect(tierForProductKey('enterpriseMonthly')).toBe('free');
    expect(tierForProductKey(undefined)).toBe('free');
    expect(tierForProductKey(null)).toBe('free');
    expect(tierForProductKey({ tier: 'pro' })).toBe('free');
  });
});

describe('productKeyFor', () => {
  it('round-trips a tier and interval back to its tier', () => {
    for (const tier of ['starter', 'pro'] as const) {
      for (const interval of ['monthly', 'yearly'] as const) {
        expect(tierForProductKey(productKeyFor(tier, interval))).toBe(tier);
      }
    }
  });

  it('has no product to sell for the free tier', () => {
    expect(productKeyFor('free', 'monthly')).toBeNull();
  });
});

describe('statusEntitles', () => {
  it('keeps access during dunning', () => {
    // Cutting a paying customer off mid-retry loses the customer faster than it
    // recovers the invoice; Polar sends canceled/revoked when it truly ends.
    expect(statusEntitles('past_due')).toBe(true);
    expect(statusEntitles('active')).toBe(true);
    expect(statusEntitles('trialing')).toBe(true);
  });

  it('drops access once the subscription is really over', () => {
    expect(statusEntitles('canceled')).toBe(false);
    expect(statusEntitles('revoked')).toBe(false);
    expect(statusEntitles('incomplete_expired')).toBe(false);
    expect(statusEntitles(undefined)).toBe(false);
  });
});

describe('normalizeTier', () => {
  it('refuses to widen access from an unexpected value', () => {
    expect(normalizeTier('enterprise')).toBe('free');
    expect(normalizeTier(2)).toBe('free');
    expect(normalizeTier(undefined)).toBe('free');
  });
});

describe('tierAllows', () => {
  it('gates the capabilities each plan is sold on', () => {
    expect(tierAllows('free', 'convert')).toBe(false);
    expect(tierAllows('starter', 'convert')).toBe(true);
    expect(tierAllows('starter', 'nlCommands')).toBe(false);
    expect(tierAllows('pro', 'nlCommands')).toBe(true);
  });
});
