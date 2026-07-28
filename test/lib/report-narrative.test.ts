import { describe, expect, it } from 'vitest';
import { buildBriefFacts, activeSections } from '../../lib/report-brief';
import {
  narrateSection, joinList, plural, buildSectionPrompt, sentenceCase,
  countWord, periodPhrase, decisionItems, parseSectionResponse,
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
    expect(text).toContain('completed two items');
    expect(text).toContain('One item needs a decision');
    expect(text).not.toMatch(/\b\d+ (items?|entries) (completed|blocked)/);
  });

  it('keeps money numeric while counts stay spelled', () => {
    const mixed = buildBriefFacts([
      log({ entities: [entity({ type: 'expense', amount: 1200, currency: 'USD' })] }),
      log({ entities: [entity({ type: 'task', status: 'complete', deliverable: 'A' })] }),
    ]);
    const text = narrateSection('executive_summary', mixed, ctx);
    expect(text).toContain('USD 1,200');
    expect(text).toContain('completed one item');
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

  it('opens the executive summary on what was achieved, not on how much was logged', () => {
    // An entry count measures use of this tool, not the state of the business.
    // It is the one number a client explicitly cannot act on, so it does not
    // get the opening sentence.
    const text = narrateSection('executive_summary', facts, ctx);
    expect(text).toContain('Acme Rebrand');
    expect(text).toMatch(/^Acme Rebrand completed one item/);
    expect(text).toContain('USD 5,000');
    expect(text).toContain('USD 1,200');
    expect(text).not.toContain('four entries');
    // Deliverable names belong to Progress, which sits directly below. An
    // executive summary that repeats the section under it is twice the length
    // for the same information.
    expect(text).not.toContain('Logo pack');
  });

  it('falls back to volume only when the period finished nothing', () => {
    const nothing = buildBriefFacts([
      log({ category: 'Clients', entities: [entity({ type: 'client_update' })] }),
      log({ category: 'Clients', entities: [entity({ type: 'client_update' })] }),
    ]);
    const text = narrateSection('executive_summary', nothing, ctx);
    expect(text).toContain('two entries');
    expect(text).toContain('nothing yet completed');
  });

  it('writes progress covering what was completed and delivered', () => {
    const text = narrateSection('progress', facts, ctx);
    expect(text).toContain('One item completed');
    expect(text).toContain('Logo pack');
    // Blockers are named once, in the decisions section — see below.
    expect(text).not.toContain('Vendor contract');
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

  it('leaves blockers out of next steps — they belong to the decisions section', () => {
    // Next Steps is what the sender will do; Needs Your Decision is what the
    // reader must. Stating a blocker in both turns the ask back into noise.
    const text = narrateSection('next_steps', facts, ctx);
    expect(text).not.toContain('Vendor contract');
    expect(text).not.toMatch(/blocked/i);
  });

  it('puts the blocker in the decisions section instead, worded as an ask', () => {
    expect(narrateSection('decisions', facts, ctx)).toContain('held up pending a decision');
    // The age rides on the ask: "blocked" is a status, "open 8 days" is the
    // argument for answering it today.
    expect(decisionItems(facts)).toEqual(['Vendor contract — open 8 days']);
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

describe('parseSectionResponse', () => {
  const ids = ['executive_summary', 'progress', 'financials'] as const;

  it('splits the reply on its section markers', () => {
    const reply = [
      '### executive_summary',
      'Northwind completed two items.',
      '',
      '### progress',
      'Guidelines signed off.',
      'Launch deck delivered.',
    ].join('\n');
    expect(parseSectionResponse(reply, [...ids])).toEqual({
      executive_summary: 'Northwind completed two items.',
      progress: 'Guidelines signed off.\nLaunch deck delivered.',
    });
  });

  it('survives prose that would have broken JSON', () => {
    // The whole reason this is not JSON: a model writing prose emits raw line
    // breaks, unescaped quotes and stray punctuation, any one of which made
    // JSON.parse reject the entire document and discard every section at once.
    const reply = '### progress\nHe said "it slipped" — and it did,\nover two lines.';
    expect(parseSectionResponse(reply, [...ids]).progress)
      .toBe('He said "it slipped" — and it did,\nover two lines.');
  });

  it('keeps the good sections when one is malformed', () => {
    const reply = '### progress\nReal prose.\n\n### not_a_section\nJunk.\n\n### financials\nSpend was flat.';
    const out = parseSectionResponse(reply, [...ids]);
    expect(out.progress).toContain('Real prose.');
    expect(out.financials).toBe('Spend was flat.');
  });

  it('ignores anything the model writes before the first marker', () => {
    expect(parseSectionResponse('Sure, here you go:\n### progress\nDone.', [...ids]))
      .toEqual({ progress: 'Done.' });
  });

  it('returns nothing rather than guessing when there are no markers', () => {
    expect(parseSectionResponse('Just some prose with no markers.', [...ids])).toEqual({});
  });
});
