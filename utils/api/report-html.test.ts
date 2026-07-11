import { describe, expect, it } from 'vitest';
import { normalizeReportSections, renderReportHtml, type ReportSections } from './report-html';

describe('normalizeReportSections', () => {
  it('coerces garbage input into a valid empty report', () => {
    expect(normalizeReportSections(null)).toEqual({
      summary: 'No summary available for this period.',
      highlights: [],
      financials: { total: null, currency: null, note: null },
      next_steps: [],
    });
    expect(normalizeReportSections('not an object')).toEqual(normalizeReportSections(undefined));
  });

  it('keeps well-formed AI output intact', () => {
    const input = {
      summary: 'A productive week.',
      highlights: [{ category: 'Marketing', items: ['Launched campaign'] }],
      financials: { total: 1200, currency: 'USD', note: 'Print materials' },
      next_steps: ['Review results'],
    };
    expect(normalizeReportSections(input)).toEqual(input);
  });

  it('drops malformed highlight entries and empty item lists', () => {
    const result = normalizeReportSections({
      highlights: [
        'not an object',
        { category: 42, items: ['kept', 7, 'also kept'] },
        { category: 'Empty', items: [] },
        { category: 'NoItems' },
      ],
    });
    expect(result.highlights).toEqual([{ category: 'General', items: ['kept', 'also kept'] }]);
  });

  it('caps lengths and counts', () => {
    const result = normalizeReportSections({
      summary: 'x'.repeat(5000),
      highlights: Array.from({ length: 20 }, (_, i) => ({
        category: 'c'.repeat(100),
        items: Array.from({ length: 30 }, () => 'i'.repeat(1000)),
      })),
      next_steps: Array.from({ length: 30 }, () => 's'.repeat(1000)),
    });
    expect(result.summary).toHaveLength(2000);
    expect(result.highlights).toHaveLength(8);
    expect(result.highlights[0].category).toHaveLength(60);
    expect(result.highlights[0].items).toHaveLength(10);
    expect(result.highlights[0].items[0]).toHaveLength(400);
    expect(result.next_steps).toHaveLength(10);
    expect(result.next_steps[0]).toHaveLength(300);
  });

  it('rejects non-finite financial totals', () => {
    expect(normalizeReportSections({ financials: { total: Infinity } }).financials.total).toBeNull();
    expect(normalizeReportSections({ financials: { total: '1200' } }).financials.total).toBeNull();
  });
});

describe('renderReportHtml', () => {
  const sections: ReportSections = {
    summary: 'Solid progress.',
    highlights: [{ category: 'Projects', items: ['Homepage shipped'] }],
    financials: { total: 1200, currency: 'USD', note: 'Campaign spend' },
    next_steps: ['Send invoice'],
  };

  it('renders a full client report document', () => {
    const html = renderReportHtml({ client: 'Meridian Corp', days: 7, sections });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Client Report — Meridian Corp');
    expect(html).toContain('the past week');
    expect(html).toContain('Solid progress.');
    expect(html).toContain('Financial Summary');
    expect(html).toContain('USD');
    expect(html).toContain('1,200');
    expect(html).toContain('Homepage shipped');
    expect(html).toContain('Next Steps');
    expect(html).toContain('Send invoice');
  });

  it('renders the all-clients variant with period wording', () => {
    const html = renderReportHtml({ client: null, days: 30, sections });
    expect(html).toContain('Business Report — All Clients');
    expect(html).toContain('the past month');
    expect(renderReportHtml({ client: null, days: 90, sections })).toContain('the past 90 days');
  });

  it('escapes HTML in every user/AI-controlled field', () => {
    const html = renderReportHtml({
      client: '<script>alert(1)</script>',
      days: 7,
      sections: {
        summary: '<img src=x onerror=alert(1)>',
        highlights: [{ category: '<b>cat</b>', items: ['<i>item</i>'] }],
        financials: { total: 1, currency: '<u>USD</u>', note: '<hr>' },
        next_steps: ['<script>steal()</script>'],
      },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>cat</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits empty sections gracefully', () => {
    const html = renderReportHtml({
      client: null,
      days: 7,
      sections: normalizeReportSections({}),
    });
    expect(html).toContain('No highlights recorded for this period.');
    expect(html).not.toContain('Financial Summary');
    expect(html).not.toContain('Next Steps');
  });
});
