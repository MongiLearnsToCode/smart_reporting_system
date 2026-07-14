import { describe, expect, it } from 'vitest';
import { resolveDateReference } from '../../utils/api/date-reference';

// 2026-07-12 is a Sunday. 22:30 UTC = 00:30 Jul 13 in Africa/Johannesburg (UTC+2).
const SUNDAY_EVENING_UTC = new Date('2026-07-12T22:30:00Z');

describe('resolveDateReference', () => {
  it('resolves today/yesterday/tomorrow in the user timezone', () => {
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
    expect(resolveDateReference('yesterday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-11');
    expect(resolveDateReference('tomorrow', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-13');
  });

  it('crosses midnight correctly for non-UTC timezones', () => {
    // Already Monday Jul 13 in Johannesburg
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'Africa/Johannesburg')).toBe('2026-07-13');
    expect(resolveDateReference('yesterday', SUNDAY_EVENING_UTC, 'Africa/Johannesburg')).toBe('2026-07-12');
  });

  it('treats tonight and this morning/afternoon/evening as today', () => {
    for (const ref of ['tonight', 'this morning', 'this afternoon', 'this evening']) {
      expect(resolveDateReference(ref, SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
    }
  });

  it('resolves "last <weekday>", going a full week back on the same weekday', () => {
    // Jul 12 2026 is a Sunday
    expect(resolveDateReference('last Friday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-10');
    expect(resolveDateReference('last Sunday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
    // On a Friday, "last Friday" means 7 days ago
    const friday = new Date('2026-07-10T12:00:00Z');
    expect(resolveDateReference('last friday', friday, 'UTC')).toBe('2026-07-03');
  });

  it('resolves "next <weekday>" and a bare weekday (most recent occurrence)', () => {
    expect(resolveDateReference('next Tuesday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-14');
    expect(resolveDateReference('on friday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-10');
    expect(resolveDateReference('Sunday', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-12');
  });

  it('resolves relative day counts and last week', () => {
    expect(resolveDateReference('3 days ago', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-09');
    expect(resolveDateReference('last week', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
    expect(resolveDateReference('a week ago', SUNDAY_EVENING_UTC, 'UTC')).toBe('2026-07-05');
  });

  it('returns null for unparseable or missing references', () => {
    expect(resolveDateReference('when the invoice cleared', SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
    expect(resolveDateReference(null, SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
    expect(resolveDateReference('', SUNDAY_EVENING_UTC, 'UTC')).toBeNull();
  });

  it('returns null instead of throwing for a bad timezone', () => {
    expect(resolveDateReference('today', SUNDAY_EVENING_UTC, 'Not/AZone')).toBeNull();
  });
});
