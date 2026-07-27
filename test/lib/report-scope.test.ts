import { describe, expect, it } from 'vitest';
import { resolveRegenerationScope } from '../../lib/report-scope';

const CAN_SWITCH = true;

describe('resolveRegenerationScope', () => {
  it('proceeds when the report and the active scope match', () => {
    expect(resolveRegenerationScope({ projectId: 'p1', projectName: 'Acme' }, 'p1', CAN_SWITCH))
      .toEqual({ action: 'proceed' });
    expect(resolveRegenerationScope({ projectId: null }, null, CAN_SWITCH))
      .toEqual({ action: 'proceed' });
  });

  it('treats a report written before scopes existed as business-wide', () => {
    expect(resolveRegenerationScope({}, null, CAN_SWITCH)).toEqual({ action: 'proceed' });
    expect(resolveRegenerationScope({}, 'p1', CAN_SWITCH).action).toBe('switch');
  });

  it('asks to switch rather than silently rebuilding from another scope', () => {
    expect(resolveRegenerationScope({ projectId: 'p1', projectName: 'Acme' }, null, CAN_SWITCH))
      .toEqual({ action: 'switch', projectId: 'p1', scopeName: 'Acme' });
    // …and back the other way, to the business as a whole.
    expect(resolveRegenerationScope({ projectId: null }, 'p1', CAN_SWITCH))
      .toEqual({ action: 'switch', projectId: null, scopeName: 'Entire business' });
  });

  it('never rebuilds a report whose project was deleted', () => {
    const decision = resolveRegenerationScope({ projectId: 'gone', projectName: null }, null, CAN_SWITCH);
    expect(decision.action).toBe('block');
    expect(decision).toMatchObject({ reason: expect.stringMatching(/deleted/i) });
  });

  it('blocks instead of switching when the caller cannot change scope', () => {
    const decision = resolveRegenerationScope({ projectId: 'p1', projectName: 'Acme' }, null, false);
    expect(decision.action).toBe('block');
    expect(decision).toMatchObject({ reason: expect.stringMatching(/acme/i) });
  });

  it('does not confuse a project scope with a different project', () => {
    expect(resolveRegenerationScope({ projectId: 'p1', projectName: 'Acme' }, 'p2', CAN_SWITCH))
      .toEqual({ action: 'switch', projectId: 'p1', scopeName: 'Acme' });
  });
});
