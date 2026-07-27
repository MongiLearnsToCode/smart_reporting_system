import { describe, expect, it } from 'vitest';
import { buildBriefFacts } from '../../lib/report-brief';
import {
  assembleBrief,
  collectAllowedNumbers,
  extractFigures,
  hasUnsupportedFigures,
} from '../../lib/report-assemble';
import { hasFiller } from '../../lib/report-prose';
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

const ctx = { scopeLabel: 'Acme Rebrand', periodLabel: 'This week' };

const facts = buildBriefFacts([
  log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
  log({ category: 'Finance', entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
  log({ category: 'Tasks', entities: [entity({ type: 'task', status: 'complete', deliverable: 'Logo pack' })] }),
]);

describe('extractFigures', () => {
  it('reads numbers through thousands separators', () => {
    expect(extractFigures('Spend hit USD 1,200 and USD 5,000.')).toEqual([1200, 5000]);
    expect(extractFigures('Margin was 12.5 percent.')).toEqual([12.5]);
    expect(extractFigures('No numbers here.')).toEqual([]);
  });
});

describe('collectAllowedNumbers', () => {
  it('admits every figure the facts support', () => {
    const allowed = collectAllowedNumbers(facts, ctx);
    expect(allowed).toContain(1200);
    expect(allowed).toContain(5000);
    expect(allowed).toContain(3800); // net
    expect(allowed).toContain(3); // entry count
  });

  it('admits numbers appearing in the period label', () => {
    const allowed = collectAllowedNumbers(facts, { ...ctx, periodLabel: 'Last 30 days' });
    expect(allowed).toContain(30);
  });
});

describe('hasUnsupportedFigures', () => {
  const allowed = collectAllowedNumbers(facts, ctx);

  it('passes prose that only cites real figures', () => {
    expect(hasUnsupportedFigures('Spend totalled USD 1,200 against USD 5,000.', allowed)).toBe(false);
  });

  it('catches an invented figure', () => {
    expect(hasUnsupportedFigures('Spend totalled USD 9,999.', allowed)).toBe(true);
  });

  it('catches a plausible-looking but wrong total', () => {
    // 6,200 is spend + income — arithmetic the model did, not a stated fact.
    expect(hasUnsupportedFigures('Combined activity reached USD 6,200.', allowed)).toBe(true);
  });

  it('tolerates rounding within a cent', () => {
    const centFacts = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 1500.5, currency: 'USD' })] }),
    ]);
    const centAllowed = collectAllowedNumbers(centFacts, ctx);
    expect(hasUnsupportedFigures('Spend was USD 1,500.50.', centAllowed)).toBe(false);
  });
});

describe('assembleBrief', () => {
  it('prefers model prose when it is clean and supported', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: {
        executive_summary: 'Acme Rebrand booked USD 5,000 of income against USD 1,200 of spend.',
      },
    });
    const summary = brief.sections.find((s) => s.id === 'executive_summary')!;
    expect(summary.source).toBe('ai');
    expect(summary.body).toContain('USD 5,000');
  });

  it('falls back to facts when the model invents a figure', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: { executive_summary: 'Revenue reached USD 42,000 this week.' },
    });
    const summary = brief.sections.find((s) => s.id === 'executive_summary')!;
    expect(summary.source).toBe('facts');
    expect(summary.body).not.toContain('42,000');
  });

  it('falls back when the model returns only filler', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: { executive_summary: 'Certainly! Let me know if you need anything else.' },
    });
    expect(brief.sections.find((s) => s.id === 'executive_summary')!.source).toBe('facts');
  });

  it('falls back for every section when the model is unavailable', () => {
    const brief = assembleBrief({ title: 'Weekly update', facts, ctx, aiSections: null });
    expect(brief.sections.length).toBeGreaterThan(0);
    expect(brief.sections.every((s) => s.source === 'facts')).toBe(true);
    expect(brief.sections.every((s) => s.body.length > 0)).toBe(true);
  });

  it('strips filler from otherwise usable model prose', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: {
        executive_summary:
          'Certainly! Acme Rebrand booked USD 5,000 of income. I hope this helps.',
      },
    });
    const summary = brief.sections.find((s) => s.id === 'executive_summary')!;
    expect(summary.source).toBe('ai');
    expect(summary.body).toBe('Acme Rebrand booked USD 5,000 of income.');
  });

  it('emits no filler in any section, from either source', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: { progress: 'Overall, it is worth noting that 1 item completed.' },
    });
    for (const section of brief.sections) expect(hasFiller(section.body)).toBe(false);
  });

  it('caps each section to keep the brief succinct', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      aiSections: {
        executive_summary: 'One. Two. Three. Four. Five. Six.',
      },
      maxSentences: 3,
    });
    const summary = brief.sections.find((s) => s.id === 'executive_summary')!;
    expect(summary.body.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBeLessThanOrEqual(3);
  });

  it('omits sections the facts cannot support', () => {
    const noMoney = buildBriefFacts([
      log({ entities: [entity({ type: 'task', status: 'open', task: 'Draft' })] }),
    ]);
    const brief = assembleBrief({ title: 'Weekly update', facts: noMoney, ctx });
    expect(brief.sections.map((s) => s.id)).not.toContain('financials');
  });

  it('returns no sections for an empty period', () => {
    const brief = assembleBrief({ title: 'Weekly update', facts: buildBriefFacts([]), ctx });
    expect(brief.sections).toEqual([]);
  });

  it('carries scope, period and title through for the document header', () => {
    const brief = assembleBrief({
      title: 'Weekly update',
      facts,
      ctx,
      generatedAt: 1700000000000,
    });
    expect(brief.title).toBe('Weekly update');
    expect(brief.scopeLabel).toBe('Acme Rebrand');
    expect(brief.periodLabel).toBe('This week');
    expect(brief.generatedAt).toBe(1700000000000);
  });

  it('orders sections as an executive brief reads', () => {
    const full = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 10, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'open', task: 'Draft' })] }),
    ]);
    const brief = assembleBrief({ title: 'Weekly update', facts: full, ctx });
    expect(brief.sections.map((s) => s.id)).toEqual([
      'executive_summary',
      'progress',
      'financials',
      'next_steps',
    ]);
  });
});
