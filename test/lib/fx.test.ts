import { describe, expect, it } from 'vitest';
import {
  applyQuote, baseAmountOf, convertAmount, ECB_CURRENCIES, isEcbPair, isoDay,
  needsConversion, normalizeCurrency, rateFootnote, rateKey,
} from '../../lib/fx';
import type { LogEntity } from '../../lib/dashboard-utils';

function money(over: Partial<LogEntity> = {}): LogEntity {
  return {
    type: 'expense', category: 'Finance', date: '2026-07-09', date_reference: null,
    amount: 6500, currency: 'ZAR', client: null, project: null, task: null,
    status: null, issue_or_risk: null, deliverable: null, sentiment: null,
    urgency: null, confidence: 0.9, ...over,
  };
}

const quote = { rate: 0.06108, rateDate: '2026-07-09', source: 'ECB' };

describe('normalizeCurrency', () => {
  it('accepts a three-letter code in any case, with padding', () => {
    expect(normalizeCurrency('  zar ')).toBe('ZAR');
  });

  it('rejects anything that is not an ISO-shaped code', () => {
    for (const bad of ['R', 'rands', 'US$', '', null, 42, 'USDD']) {
      expect(normalizeCurrency(bad)).toBeNull();
    }
  });
});

describe('needsConversion', () => {
  it('is true only when there is an amount in a different currency', () => {
    expect(needsConversion(money(), 'USD')).toBe(true);
    expect(needsConversion(money({ currency: 'USD' }), 'USD')).toBe(false);
    expect(needsConversion(money({ amount: null }), 'USD')).toBe(false);
  });

  it('treats an unstated currency as already in base — the extractor was told to default it', () => {
    expect(needsConversion(money({ currency: null }), 'USD')).toBe(false);
  });
});

describe('convertAmount', () => {
  it('rounds to cents, because the source rate cannot support more', () => {
    expect(convertAmount(6500, 0.06108)).toBe(397.02);
  });

  it('does not accumulate float dust', () => {
    expect(convertAmount(0.1 + 0.2, 1)).toBe(0.3);
  });
});

describe('applyQuote', () => {
  it('never touches the amount or currency the user actually stated', () => {
    const applied = applyQuote(money(), 'USD', quote);
    expect(applied.amount).toBe(6500);
    expect(applied.currency).toBe('ZAR');
  });

  it('records enough provenance to reproduce the conversion', () => {
    const applied = applyQuote(money(), 'USD', quote);
    expect(applied.base_amount).toBe(397.02);
    expect(applied.base_currency).toBe('USD');
    expect(applied.fx_rate).toBe(0.06108);
    expect(applied.fx_date).toBe('2026-07-09');
    expect(applied.fx_source).toBe('ECB');
  });
});

describe('baseAmountOf', () => {
  it('returns the amount unchanged when it is already in base', () => {
    expect(baseAmountOf(money({ currency: 'USD', amount: 512 }), 'USD')).toBe(512);
  });

  it('returns the amount unchanged when no currency was ever stated', () => {
    expect(baseAmountOf(money({ currency: null, amount: 512 }), 'USD')).toBe(512);
  });

  it('returns the converted figure once a quote has been applied', () => {
    expect(baseAmountOf(applyQuote(money(), 'USD', quote), 'USD')).toBe(397.02);
  });

  it('returns null when no rate was ever obtained — the caller must not guess', () => {
    expect(baseAmountOf(money(), 'USD')).toBeNull();
  });

  it('refuses a conversion aimed at a currency the user has since moved off', () => {
    // Stored against USD, but the report is in ZAR now. Returning 397.02 here
    // would silently label a USD figure as rands.
    const applied = applyQuote(money(), 'USD', quote);
    expect(baseAmountOf(applied, 'GBP')).toBeNull();
  });
});

describe('isEcbPair', () => {
  it('accepts pairs the ECB publishes, which is what allows a dated rate', () => {
    expect(isEcbPair('ZAR', 'USD')).toBe(true);
    expect(isEcbPair('GBP', 'EUR')).toBe(true);
  });

  it('rejects the currencies the ECB does not publish', () => {
    // NGN, KES and GHS are in the app's currency list and matter to this
    // audience — they route to the latest-rate provider instead.
    for (const code of ['NGN', 'KES', 'GHS']) {
      expect(ECB_CURRENCIES.has(code)).toBe(false);
      expect(isEcbPair(code, 'USD')).toBe(false);
    }
  });
});

describe('rateKey and isoDay', () => {
  it('keys a pair on a day, so the cache is shared across users', () => {
    expect(rateKey('ZAR', 'USD', '2026-07-09')).toBe('ZAR:USD:2026-07-09');
  });

  it('reduces any timestamp to the day rates are quoted at', () => {
    expect(isoDay('2026-07-09T22:14:00.000Z')).toBe('2026-07-09');
    expect(isoDay(new Date('2026-07-09T00:00:00Z'))).toBe('2026-07-09');
  });
});

describe('rateFootnote', () => {
  it('names every rate relied on, so a converted total is auditable', () => {
    const line = rateFootnote([
      { from: 'ZAR', to: 'USD', rate: 0.06108, date: '2026-07-09', source: 'ECB' },
    ]);
    expect(line).toContain('1 ZAR = 0.06108 USD (2026-07-09)');
    expect(line).toContain('Source: ECB');
  });

  it('states each pair once however many entries used it', () => {
    const line = rateFootnote([
      { from: 'ZAR', to: 'USD', rate: 0.06108, date: '2026-07-09', source: 'ECB' },
      { from: 'ZAR', to: 'USD', rate: 0.06108, date: '2026-07-09', source: 'ECB' },
    ])!;
    expect(line.match(/1 ZAR/g)).toHaveLength(1);
  });

  it('says nothing when nothing was converted', () => {
    expect(rateFootnote([])).toBeNull();
    expect(rateFootnote([{ from: 'USD', to: 'USD', rate: 1, date: '2026-07-09', source: 'identity' }]))
      .toBeNull();
  });
});
