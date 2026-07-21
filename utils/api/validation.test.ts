import { describe, expect, it } from 'vitest';
import { parseExportPayload, parseProcessPayload, parseReportPayload, parseSettings } from './validation';

describe('validation helpers', () => {
  it('whitelists settings and drops unknown values', () => {
    expect(
      parseSettings({
        currency: 'ZAR',
        timezone: 'Mars/Base',
        ai_language: 'Klingon',
        conflict_detection: false,
        conflict_dismiss_days: 999,
        default_widget_sort: 'recent',
        canvas_density: 'tiny',
        extra: 'ignored',
      }),
    ).toEqual({
      currency: 'ZAR',
      timezone: 'UTC',
      ai_language: 'English',
      conflict_detection: false,
      conflict_dismiss_days: 90,
      default_widget_sort: 'recent',
      canvas_density: 'comfortable',
      data_retention_days: 90,
      tier: 'free',
    });
  });

  it('whitelists the plan tier and falls back to free', () => {
    expect(parseSettings({ tier: 'pro' }).tier).toBe('pro');
    expect(parseSettings({ tier: 'enterprise' }).tier).toBe('free');
  });

  it('rejects empty process payloads', () => {
    expect(() => parseProcessPayload({ rawContent: '   ' })).toThrow('Log content is required');
  });

  it('normalizes export payloads', () => {
    expect(parseExportPayload({ range: '500', template: '<bad>' })).toEqual({
      range: 365,
      template: '<bad>',
    });
  });

  it('normalizes report payloads', () => {
    expect(parseReportPayload({ days: 30, client: '  Meridian Corp  ' })).toEqual({
      days: 30,
      client: 'Meridian Corp',
    });
  });

  it('defaults report payloads and clamps out-of-range values', () => {
    expect(parseReportPayload({})).toEqual({ days: 7, client: null });
    expect(parseReportPayload(null)).toEqual({ days: 7, client: null });
    expect(parseReportPayload({ days: 9999, client: '' })).toEqual({ days: 365, client: null });
    expect(parseReportPayload({ days: 0, client: 42 })).toEqual({ days: 1, client: null });
    expect(parseReportPayload({ client: 'x'.repeat(200) }).client).toHaveLength(80);
  });
});
