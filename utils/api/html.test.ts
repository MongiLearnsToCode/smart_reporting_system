import { describe, expect, it } from 'vitest';
import { escapeHtml, safeFilenamePart } from './html';

describe('html helpers', () => {
  it('escapes values before injecting them into report HTML', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('sanitizes filenames used in content disposition headers', () => {
    expect(safeFilenamePart('../Quarterly Report <Q1>')).toBe('Quarterly_Report_Q1');
  });
});
