// Renders an executive brief to PDF via @react-pdf/renderer.
//
// Design direction: a premium consulting document, not a dashboard dump. Wide
// margins, generous leading, and a light ground so the page reads as printed
// paper rather than a screenshot of the app's dark canvas. Prose carries the
// report; the table, stat strip and figures appear only where they earn space.
//
// Imported dynamically from the reports modal so react-pdf stays out of the
// initial bundle — it's only pulled in when a user actually exports.
import {
  pdf, Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer';
import type { Stat } from '@/lib/report-tables';
import { CHART_INK, type FinancialVisual } from '@/lib/report-chart';

export type ReportPdfSection = { title: string; body: string; items?: string[] };

export type ReportPdfInput = {
  title: string;
  companyName: string;
  scopeLabel: string;
  periodLabel: string;
  generatedAt: string;
  sections: ReportPdfSection[];
  stats?: Stat[];
  /** Chart or table for the Financials section — chosen by financialVisual(). */
  financials?: FinancialVisual;
  unconvertedTransactions?: number;
};

// One scale, so spacing stays proportional rather than ad hoc.
const INK = '#18181b';
const BODY = '#3f3f46';
const MUTED = '#8a8a94';
const HAIRLINE = '#e7e7ea';

const styles = StyleSheet.create({
  page: {
    // The validated light chart surface — the hue was checked for contrast
    // against this exact tone, not against pure white.
    backgroundColor: '#fcfcfb',
    // ~24mm sides: the single biggest contributor to a document feeling airy.
    paddingTop: 52,
    paddingHorizontal: 68,
    paddingBottom: 48,
    fontFamily: 'Helvetica',
    color: BODY,
  },

  brand: {
    fontSize: 7.5,
    letterSpacing: 3,
    color: MUTED,
    fontFamily: 'Helvetica-Bold',
  },
  title: {
    fontSize: 23,
    lineHeight: 1.25,
    color: INK,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
  },
  meta: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: MUTED,
    marginTop: 10,
  },
  headerRule: {
    marginTop: 24,
    borderBottomWidth: 0.75,
    borderBottomColor: HAIRLINE,
  },

  statStrip: {
    flexDirection: 'row',
    marginTop: 26,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 0,
    paddingRight: 16,
  },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: MUTED,
  },
  statValue: {
    fontSize: 13,
    color: INK,
    fontFamily: 'Helvetica-Bold',
    marginTop: 7,
  },
  statDelta: {
    fontSize: 8.5,
    color: MUTED,
    marginTop: 3,
  },

  section: {
    // Tight enough that a five-section brief still lands on one page. The
    // decisions section is last, and a one-page report whose call to action
    // sits alone on page two has buried the only part that needs answering.
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: MUTED,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 10.5,
    // Generous leading is what makes a dense paragraph scannable.
    lineHeight: 1.75,
    color: BODY,
    textAlign: 'left',
  },

  table: {
    marginTop: 20,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableLabel: {
    fontSize: 10,
    color: BODY,
    flexShrink: 1,
    paddingRight: 16,
  },
  tableValue: {
    fontSize: 10,
    color: INK,
    fontFamily: 'Helvetica-Bold',
  },
  tableTotalLabel: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MUTED,
  },

  // The asks. A short list, because the one thing a reader must act on should
  // not have to be picked back out of a paragraph.
  askList: {
    marginTop: 8,
  },
  askRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  askBullet: {
    fontSize: 10.5,
    lineHeight: 1.6,
    color: MUTED,
    width: 14,
  },
  askText: {
    fontSize: 10.5,
    lineHeight: 1.6,
    color: INK,
    flexShrink: 1,
  },

  // Native vector chart. Drawn from the numbers rather than captured, so it is
  // light-mode and print-sharp regardless of the app's theme.
  chart: {
    marginTop: 18,
  },
  chartCaption: {
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 14,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Surface gap between adjacent bars, so fills never touch.
    marginBottom: 9,
  },
  barLabel: {
    fontSize: 9,
    color: BODY,
    width: 96,
    paddingRight: 10,
  },
  barTrack: {
    flexGrow: 1,
    flexBasis: 0,
    height: 11,
    justifyContent: 'center',
  },
  barFill: {
    height: 11,
    backgroundColor: CHART_INK,
    // Rounded data-end, anchored square to the baseline it grows from.
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  barValue: {
    fontSize: 9,
    // Text wears text ink, never the series colour.
    color: INK,
    fontFamily: 'Helvetica-Bold',
    width: 96,
    paddingLeft: 12,
    textAlign: 'right',
  },

  footer: {
    position: 'absolute',
    bottom: 30,
    left: 68,
    right: 68,
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: MUTED,
    textAlign: 'center',
  },
  financialNote: {
    fontSize: 7.5,
    lineHeight: 1.45,
    color: MUTED,
    marginTop: 10,
  },
});

function FinancialsVisual({ visual }: { visual: FinancialVisual }) {
  if (!visual) return null;

  if (visual.kind === 'chart') {
    return (
      <View style={styles.chart}>
        <Text style={styles.chartCaption}>Spend by category · {visual.currency}</Text>
        {visual.bars.map((bar, i) => (
          <View key={i} style={styles.barRow} wrap={false}>
            <Text style={styles.barLabel}>{bar.label}</Text>
            <View style={styles.barTrack}>
              {/* Percentage width keeps the bars proportional at any page size. */}
              <View style={[styles.barFill, { width: `${Math.max(2, bar.ratio * 100)}%` }]} />
            </View>
            <Text style={styles.barValue}>{bar.formatted}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {visual.rows.map((row, r) => {
        const isTotal = r === visual.rows.length - 1 && row.label === 'Total spend';
        return (
          <View
            key={r}
            style={
              r === visual.rows.length - 1
                ? [styles.tableRow, styles.tableRowLast]
                : styles.tableRow
            }
            wrap={false}
          >
            <Text style={isTotal ? styles.tableTotalLabel : styles.tableLabel}>{row.label}</Text>
            <Text style={styles.tableValue}>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export async function buildReportPdf(input: ReportPdfInput): Promise<Blob> {
  const stats = input.stats ?? [];

  const doc = (
    <Document title={input.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{input.companyName.toUpperCase()}</Text>
        <Text style={styles.title}>{input.title}</Text>
        <Text style={styles.meta}>
          {input.scopeLabel} · {input.periodLabel} · {input.generatedAt}
        </Text>
        <View style={styles.headerRule} />

        {stats.length > 0 && (
          <View style={styles.statStrip} wrap={false}>
            {stats.map((s, i) => (
              <View key={i} style={styles.stat}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
                {s.delta ? <Text style={styles.statDelta}>{s.delta} vs previous</Text> : null}
              </View>
            ))}
          </View>
        )}

        {(input.financials || input.unconvertedTransactions) ? (
          <Text style={styles.financialNote}>
            Financial values are approximate, converted to the report currency using available exchange rates.
            {input.unconvertedTransactions
              ? ` ${input.unconvertedTransactions} transaction${input.unconvertedTransactions === 1 ? '' : 's'} without an available rate ${input.unconvertedTransactions === 1 ? 'is' : 'are'} excluded.`
              : ''}
          </Text>
        ) : null}

        {input.sections.map((section, i) => (
          // Sections are capped at four sentences, so one can never legitimately
          // need to split across pages. Keeping each whole prevents both an
          // orphaned heading and the premature break that minPresenceAhead
          // caused — it pushed a section that had ample room onto a blank page.
          <View key={i} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.paragraph}>{section.body}</Text>

            {section.items?.length ? (
              <View style={styles.askList}>
                {section.items.map((item, j) => (
                  <View key={j} style={styles.askRow} wrap={false}>
                    <Text style={styles.askBullet}>—</Text>
                    <Text style={styles.askText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {section.title === 'Financials' && <FinancialsVisual visual={input.financials ?? null} />}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${input.scopeLabel} · page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
  return pdf(doc).toBlob();
}
