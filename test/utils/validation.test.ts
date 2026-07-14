import { describe, expect, it } from 'vitest';
import { parseCorrectionPayload, parseProcessPayload } from '../../utils/api/validation';

const UUID = '2f5a1f64-9a3b-4c1d-8e2f-0a1b2c3d4e5f';

describe('parseProcessPayload', () => {
  it('keeps existing behavior for fresh submissions', () => {
    expect(parseProcessPayload({ rawContent: ' hi ', type: 'file', fileUrl: 'https://x.test/f' }))
      .toEqual({ rawContent: 'hi', type: 'file', fileUrl: 'https://x.test/f', logId: null });
    expect(() => parseProcessPayload({})).toThrow(/required/i);
    expect(() => parseProcessPayload({ rawContent: 'x'.repeat(12001) })).toThrow(/too long/i);
  });

  it('accepts a retry payload with only a logId', () => {
    expect(parseProcessPayload({ logId: UUID })).toEqual({ rawContent: '', type: 'text', fileUrl: null, logId: UUID });
  });

  it('rejects malformed logIds', () => {
    expect(() => parseProcessPayload({ logId: 'not-a-uuid' })).toThrow(/required/i);
    expect(parseProcessPayload({ logId: 'not-a-uuid', rawContent: 'hi' }).logId).toBeNull();
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
