import { describe, expect, it } from 'vitest';
import { buildBriefFacts, activeSections } from '../../lib/report-brief';
import {
  narrateSection, joinList, plural, buildSectionPrompt, sentenceCase,
  countWord, periodPhrase,
} from '../../lib/report-narrative';
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

describe('plural', () => {
  it('agrees with the count', () => {
    expect(plural(1, 'item')).toBe('one item');
    expect(plural(3, 'item')).toBe('three items');
    expect(plural(1, 'entry', 'entries')).toBe('one entry');
    expect(plural(0, 'entry', 'entries')).toBe('zero entries');
  });
});

describe('joinList', () => {
  it('joins readably and caps length', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(joinList(['a', 'b', 'c', 'd'], 3)).toBe('a, b and c');
    expect(joinList([])).toBe('');
  });
});

describe('countWord', () => {
  it('spells small counts and leaves larger ones numeric', () => {
    expect(countWord(0)).toBe('zero');
    expect(countWord(7)).toBe('seven');
    expect(countWord(12)).toBe('twelve');
    expect(countWord(13)).toBe('13');
    expect(countWord(250)).toBe('250');
  });

  it('does not mangle non-integers', () => {
    expect(countWord(2.5)).toBe('2.5');
    expect(countWord(-1)).toBe('-1');
  });
});

describe('periodPhrase', () => {
  it('reads naturally inside a sentence', () => {
    expect(periodPhrase('This week')).toBe('this week');
    expect(periodPhrase('This month')).toBe('this month');
    expect(periodPhrase('Quarter')).toBe('this quarter');
    expect(periodPhrase('Last 30 days')).toBe('over the last 30 days');
  });

  it('handles an unexpected label without producing gibberish', () => {
    expect(periodPhrase('the pilot phase')).toBe('over the pilot phase');
    expect(periodPhrase('')).toBe('');
  });
});

describe('number style', () => {
  const facts = buildBriefFacts([
    log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'A' })] }),
    log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'B' })] }),
    log({ entities: [entity({ type: 'task', status: 'blocked', task: 'C' })] }),
  ]);

  it('does not mix spelled and numeric counts in one sentence', () => {
    // "Two items completed, with 1 blocked" reads as machine output.
    const text = narrateSection('executive_summary', facts, ctx);
    expect(text).toContain('Two items completed, with one blocked');
    expect(text).not.toMatch(/\bwith \d+ blocked/);
  });

  it('keeps money numeric while counts stay spelled', () => {
    const mixed = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'A' })] }),
    ]);
    const text = narrateSection('executive_summary', mixed, ctx);
    expect(text).toContain('USD 1,200');
    expect(text).toContain('One item completed');
  });
});

describe('sentenceCase', () => {
  it('spells out a leading numeral rather than opening with a digit', () => {
    expect(sentenceCase('2 items completed.')).toBe('Two items completed.');
    expect(sentenceCase('1 item blocked.')).toBe('One item blocked.');
  });

  it('leaves figures inside the sentence as digits', () => {
    expect(sentenceCase('spend hit USD 1,200 across 3 categories.'))
      .toBe('Spend hit USD 1,200 across 3 categories.');
  });

  it('keeps large leading numbers numeric rather than inventing words', () => {
    expect(sentenceCase('250 entries recorded.')).toBe('250 entries recorded.');
  });

  it('capitalises ordinary openings', () => {
    expect(sentenceCase('spend rose.')).toBe('Spend rose.');
    expect(sentenceCase('')).toBe('');
  });
});

describe('narrateSection', () => {
  const facts = buildBriefFacts([
    log({ category: 'Finance', entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
    log({ category: 'Finance', entities: [entity({ type: 'income', amount: 5000, currency: 'USD' })] }),
    log({ category: 'Tasks', entities: [entity({ type: 'task', status: 'complete', deliverable: 'Logo pack' })] }),
    log({ category: 'Tasks', entities: [entity({ type: 'task', status: 'blocked', task: 'Vendor contract' })] }),
  ]);

  it('writes an executive summary naming scope, volume and money', () => {
    const text = narrateSection('executive_summary', facts, ctx);
    expect(text).toContain('Acme Rebrand');
    expect(text).toContain('four entries');
    expect(text).toContain('USD 5,000');
    expect(text).toContain('USD 1,200');
  });

  it('writes progress covering completions and blockers', () => {
    const text = narrateSection('progress', facts, ctx);
    expect(text).toContain('One item completed');
    expect(text).toContain('Logo pack');
    expect(text).toContain('Vendor contract');
  });

  it('writes financials with a net position', () => {
    const text = narrateSection('financials', facts, ctx);
    expect(text).toContain('USD 1,200');
    expect(text).toContain('USD 5,000');
    expect(text).toContain('net position of USD 3,800');
  });

  it('describes a net outflow when spend exceeds income', () => {
    const loss = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 900, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'income', amount: 400, currency: 'USD' })] }),
    ]);
    expect(narrateSection('financials', loss, ctx)).toContain('net outflow of USD 500');
  });

  it('writes next steps from blocked and outstanding work', () => {
    const text = narrateSection('next_steps', facts, ctx);
    expect(text).toContain('One item blocked');
    expect(text).toContain('Vendor contract');
  });

  it('never emits filler', () => {
    for (const id of activeSections(facts)) {
      expect(hasFiller(narrateSection(id, facts, ctx))).toBe(false);
    }
  });

  it('produces complete sentences for every active section', () => {
    for (const id of activeSections(facts)) {
      const text = narrateSection(id, facts, ctx);
      expect(text.length).toBeGreaterThan(0);
      expect(text.trim()).toMatch(/[.!?]$/);
    }
  });

  it('stays succinct — at most four sentences per section', () => {
    for (const id of activeSections(facts)) {
      const sentences = narrateSection(id, facts, ctx).split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(4);
    }
  });

  it('handles a scope with activity but no money or tasks', () => {
    const bare = buildBriefFacts([log({ category: 'Operations' })]);
    const text = narrateSection('progress', bare, ctx);
    expect(text).toContain('one entry');
    expect(text).toContain('Operations');
  });
});

describe('buildSectionPrompt', () => {
  const facts = buildBriefFacts([
    log({ entities: [entity({ type: 'expense', amount: 100, currency: 'USD' })] }),
  ]);

  it('names the exact sections the model must return', () => {
    const ids = activeSections(facts);
    const { system } = buildSectionPrompt(ids, facts, ctx);
    for (const id of ids) expect(system).toContain(id);
    expect(system).toContain('JSON');
  });

  it('forbids invention and filler in the style contract', () => {
    const { system } = buildSectionPrompt(activeSections(facts), facts, ctx);
    expect(system).toMatch(/never invent/i);
    expect(system).toMatch(/no preamble/i);
  });

  it('sends the facts as the only source material', () => {
    const { user } = buildSectionPrompt(activeSections(facts), facts, ctx);
    const parsed = JSON.parse(user);
    expect(parsed.scope).toBe('Acme Rebrand');
    expect(parsed.period).toBe('This week');
    expect(parsed.facts.spend).toEqual([{ currency: 'USD', amount: 100 }]);
  });
});
