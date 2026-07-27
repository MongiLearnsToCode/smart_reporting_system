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
  pdf, Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer';
import type { Stat, TableRow } from '@/lib/report-tables';

export type ReportFigure = { title: string; image: string };
export type ReportPdfSection = { title: string; body: string };

export type ReportPdfInput = {
  title: string;
  scopeLabel: string;
  periodLabel: string;
  generatedAt: string;
  sections: ReportPdfSection[];
  stats?: Stat[];
  financialRows?: TableRow[];
  figures?: ReportFigure[];
};

// One scale, so spacing stays proportional rather than ad hoc.
const INK = '#18181b';
const BODY = '#3f3f46';
const MUTED = '#8a8a94';
const HAIRLINE = '#e7e7ea';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    // ~24mm sides: the single biggest contributor to a document feeling airy.
    paddingTop: 62,
    paddingHorizontal: 68,
    paddingBottom: 76,
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
    marginTop: 30,
    borderBottomWidth: 0.75,
    borderBottomColor: HAIRLINE,
  },

  statStrip: {
    flexDirection: 'row',
    marginTop: 30,
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

  section: {
    marginTop: 34,
  },
  sectionTitle: {
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: MUTED,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
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

  figure: {
    marginTop: 26,
  },
  figureCaption: {
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 9,
  },
  figureImage: {
    width: '100%',
    borderRadius: 6,
  },

  footer: {
    position: 'absolute',
    bottom: 38,
    left: 68,
    right: 68,
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: MUTED,
    textAlign: 'center',
  },
});

export async function buildReportPdf(input: ReportPdfInput): Promise<Blob> {
  const stats = input.stats ?? [];
  const rows = input.financialRows ?? [];
  const figures = input.figures ?? [];

  const doc = (
    <Document title={input.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>CODEX</Text>
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
              </View>
            ))}
          </View>
        )}

        {input.sections.map((section, i) => (
          // minPresenceAhead keeps a heading from stranding at a page foot.
          <View key={i} style={styles.section} minPresenceAhead={72}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.paragraph}>{section.body}</Text>

            {section.title === 'Financials' && rows.length > 0 && (
              <View style={styles.table}>
                {rows.map((row, r) => {
                  const isTotal = r === rows.length - 1 && row.label === 'Total spend';
                  return (
                    <View
                      key={r}
                      style={
                        r === rows.length - 1
                          ? [styles.tableRow, styles.tableRowLast]
                          : styles.tableRow
                      }
                      wrap={false}
                    >
                      <Text style={isTotal ? styles.tableTotalLabel : styles.tableLabel}>
                        {row.label}
                      </Text>
                      <Text style={styles.tableValue}>{row.value}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {figures.map((figure, i) => (
          <View key={i} style={styles.figure} wrap={false}>
            <Text style={styles.figureCaption}>{figure.title}</Text>
            <Image src={figure.image} style={styles.figureImage} />
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
