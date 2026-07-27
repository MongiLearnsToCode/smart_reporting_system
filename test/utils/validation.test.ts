import { describe, expect, it } from 'vitest';
import { parseCorrectionPayload, parseProcessPayload } from '../../utils/api/validation';

// Convex document id, not a Supabase UUID — that's what the store uses now.
const CONVEX_ID = 'jd7abc9k2m4n6p8q1r3s5t7v9w';

describe('parseProcessPayload', () => {
  it('keeps existing behavior for fresh submissions', () => {
    expect(parseProcessPayload({ rawContent: ' hi ', type: 'file', fileUrl: 'https://x.test/f' }))
      .toEqual({ rawContent: 'hi', type: 'file', fileUrl: 'https://x.test/f', logId: null, projectId: null });
    expect(() => parseProcessPayload({})).toThrow(/required/i);
    expect(() => parseProcessPayload({ rawContent: 'x'.repeat(12001) })).toThrow(/too long/i);
  });

  it('accepts a retry payload with only a logId', () => {
    expect(parseProcessPayload({ logId: CONVEX_ID }))
      .toEqual({ rawContent: '', type: 'text', fileUrl: null, logId: CONVEX_ID, projectId: null });
  });

  it('rejects malformed logIds', () => {
    expect(() => parseProcessPayload({ logId: 'nope' })).toThrow(/required/i);
    expect(parseProcessPayload({ logId: 'nope', rawContent: 'hi' }).logId).toBeNull();
  });

  it('carries a project scope through, and drops a malformed one', () => {
    expect(parseProcessPayload({ rawContent: 'hi', projectId: CONVEX_ID }).projectId).toBe(CONVEX_ID);
    expect(parseProcessPayload({ rawContent: 'hi', projectId: 'short' }).projectId).toBeNull();
    expect(parseProcessPayload({ rawContent: 'hi', projectId: { a: 1 } }).projectId).toBeNull();
    // No scope means the entry covers the business as a whole.
    expect(parseProcessPayload({ rawContent: 'hi' }).projectId).toBeNull();
  });
});

describe('parseCorrectionPayload', () => {
  it('parses corrections with an entity index', () => {
    expect(parseCorrectionPayload({ entityIndex: 0, corrections: { amount: 900, client: 'Acme', status: null } }))
      .toEqual({ entityIndex: 0, corrections: { amount: 900, client: 'Acme', status: null }, excludedFromReports: null });
  });

  it('parses an exclusion-only payload', () => {
    expect(parseCorrectionPayload({ excludedFromReports: true }))
      .toEqual({ entityIndex: null, corrections: null, excludedFromReports: true });
  });

  it('drops non-primitive correction values and oversized strings', () => {
    const parsed = parseCorrectionPayload({
      entityIndex: 1,
      corrections: { client: { nested: true }, task: 'ok', date: 'x'.repeat(400) },
    });
    expect(parsed.corrections).toEqual({ task: 'ok' });
  });

  it('rejects corrections without an index, and empty payloads', () => {
    expect(() => parseCorrectionPayload({ corrections: { amount: 1 } })).toThrow(/entityIndex/i);
    expect(() => parseCorrectionPayload({})).toThrow(/nothing to update/i);
    expect(() => parseCorrectionPayload({ entityIndex: 0, corrections: {} })).toThrow(/nothing to update/i);
  });
});
