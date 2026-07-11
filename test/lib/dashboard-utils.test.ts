import { describe, expect, it } from 'vitest';
import { uniqueClients, type Log } from '../../lib/dashboard-utils';

function log(overrides: Partial<Log>): Log {
  return {
    id: 'id',
    user_id: 'u',
    raw_content: 'content',
    type: 'text',
    category: 'general',
    is_conflict: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('uniqueClients', () => {
  it('returns distinct trimmed client names in first-seen order', () => {
    const logs = [
      log({ entities: { client: 'Meridian Corp' } }),
      log({ entities: { client: '  Acme Studios ' } }),
      log({ entities: { client: 'Meridian Corp' } }),
    ];
    expect(uniqueClients(logs)).toEqual(['Meridian Corp', 'Acme Studios']);
  });

  it('ignores logs without a usable client', () => {
    const logs = [
      log({}),
      log({ entities: {} }),
      log({ entities: { client: null } }),
      log({ entities: { client: '   ' } }),
    ];
    expect(uniqueClients(logs)).toEqual([]);
    expect(uniqueClients([])).toEqual([]);
  });
});
