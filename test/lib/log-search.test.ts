import { describe, expect, it } from 'vitest';
import {
  filterFeed, highlightParts, isSearchable, previewFor, snapshotFor, PREVIEW_LEN,
} from '../../lib/log-search';
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
    id: Math.random().toString(36).slice(2), user_id: 'u1', raw_content: 'entry',
    type: 'text', category: 'Other', entities: [], is_conflict: false,
    timestamp: '2026-07-20T10:00:00.000Z', ...over,
  };
}

describe('filterFeed', () => {
  const logs = [
    log({ id: 'a', category: 'Finance', entities: [entity({ client: 'Northwind' })] }),
    log({ id: 'b', category: 'Tasks', entities: [entity({ client: 'Northwind' })] }),
    log({ id: 'c', category: 'Finance', entities: [entity({ client: 'Meridian' })] }),
  ];

  it('narrows by category and client together, not either-or', () => {
    const out = filterFeed(logs, { category: 'Finance', client: 'Northwind', snapshotMs: null });
    expect(out.map((l) => l.id)).toEqual(['a']);
  });

  it('is a no-op when nothing is selected', () => {
    expect(filterFeed(logs, { category: null, client: null, snapshotMs: null })).toHaveLength(3);
  });

  it('is idempotent, so applying it twice cannot narrow further', () => {
    // This is what lets one filter pass run over either the loaded feed or a
    // set of server search results without tracking what each already had
    // applied to it.
    const filters = { category: 'Finance', client: null, snapshotMs: null };
    const once = filterFeed(logs, filters);
    expect(filterFeed(once, filters)).toEqual(once);
  });

  it('drops entries after the time-travel cutoff', () => {
    const dated = [
      log({ id: 'old', timestamp: '2026-07-01T10:00:00.000Z' }),
      log({ id: 'new', timestamp: '2026-07-25T10:00:00.000Z' }),
    ];
    const cutoff = new Date('2026-07-10T00:00:00.000Z').getTime();
    expect(filterFeed(dated, { category: null, client: null, snapshotMs: cutoff }).map((l) => l.id))
      .toEqual(['old']);
  });

  it('keeps an entry whose timestamp will not parse rather than hiding it', () => {
    // Silently vanishing from search with no explanation is worse than showing
    // an entry slightly out of place.
    const broken = [log({ id: 'x', timestamp: 'not a date' })];
    expect(filterFeed(broken, { category: null, client: null, snapshotMs: Date.now() })).toHaveLength(1);
  });
});

describe('snapshotFor', () => {
  it('is null at Now, so no time filtering happens at all', () => {
    expect(snapshotFor(100)).toBeNull();
  });

  it('walks back a day per step', () => {
    const now = Date.UTC(2026, 6, 28);
    expect(snapshotFor(90, now)).toBe(now - 10 * 86400000);
  });
});

describe('isSearchable', () => {
  it('treats whitespace as no search at all', () => {
    // An empty box must read as "no search applied", never as a filter that
    // matched nothing.
    expect(isSearchable('')).toBe(false);
    expect(isSearchable('   ')).toBe(false);
    expect(isSearchable('a')).toBe(true);
  });
});

describe('previewFor', () => {
  it('opens at the start when there is no query', () => {
    expect(previewFor('short entry')).toBe('short entry');
    expect(previewFor('x'.repeat(200))).toBe('x'.repeat(PREVIEW_LEN) + '…');
  });

  it('slides the window to include a match buried deep in the entry', () => {
    // A result that doesn't show the matched words reads as a wrong result,
    // even when it is right.
    const text = 'a'.repeat(300) + ' printer contract ' + 'b'.repeat(300);
    const preview = previewFor(text, 'printer');
    expect(preview).toContain('printer');
    expect(preview.startsWith('…')).toBe(true);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('leaves the opening alone when the match is already visible', () => {
    const text = 'printer contract still not signed. ' + 'x'.repeat(200);
    expect(previewFor(text, 'printer').startsWith('printer')).toBe(true);
  });
});

describe('highlightParts', () => {
  it('marks the matched term and nothing else', () => {
    const parts = highlightParts('printer contract signed', 'contract');
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(['contract']);
    expect(parts.map((p) => p.text).join('')).toBe('printer contract signed');
  });

  it('matches regardless of case', () => {
    expect(highlightParts('Printer Contract', 'printer').some((p) => p.match && p.text === 'Printer'))
      .toBe(true);
  });

  it('marks every term of a multi-word query', () => {
    const marked = highlightParts('the printer contract', 'printer contract')
      .filter((p) => p.match)
      .map((p) => p.text);
    expect(marked.join('')).toContain('printer');
    expect(marked.join('')).toContain('contract');
  });

  it('never loses or duplicates a character, whatever the terms overlap', () => {
    const text = 'contracting the contract contractor';
    for (const query of ['contract contracting', 'contractor contract', 'con tract contract']) {
      expect(highlightParts(text, query).map((p) => p.text).join('')).toBe(text);
    }
  });

  it('returns the text untouched when the query is empty', () => {
    expect(highlightParts('anything', '   ')).toEqual([{ text: 'anything', match: false }]);
  });
});
