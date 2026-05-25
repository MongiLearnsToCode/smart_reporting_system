import { describe, expect, it } from 'vitest';
import { parseExportPayload, parseProcessPayload, parseSettings } from './validation';

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
    });
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
});
