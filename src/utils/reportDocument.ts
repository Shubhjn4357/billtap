import { Platform, Share } from 'react-native';
import { printAsync, printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

type DocumentMetric = {
    label: string;
    value: string;
};

type DocumentColumn = {
    label: string;
    align?: 'left' | 'center' | 'right';
};

type DocumentSection = {
    title: string;
    caption?: string;
    columns: DocumentColumn[];
    rows: string[][];
    footerMetrics?: DocumentMetric[];
};

type ReportDocumentInput = {
    title: string;
    subtitle?: string;
    businessName?: string | null;
    contextLabel?: string;
    documentKind?: 'generic' | 'trial-balance' | 'balance-sheet' | 'gst-summary';
    summaryMetrics?: DocumentMetric[];
    sections: DocumentSection[];
};

type ExportReportDocumentInput = ReportDocumentInput & {
    shareTitle?: string;
};

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

const renderMetricCards = (metrics: DocumentMetric[]) =>
    metrics.map((metric) => `
        <div class="metric-card">
            <div class="metric-label">${escapeHtml(metric.label)}</div>
            <div class="metric-value">${escapeHtml(metric.value)}</div>
        </div>
    `).join('');

const renderTableHeader = (columns: DocumentColumn[]) =>
    columns.map((column) => `
        <th class="align-${column.align ?? 'left'}">${escapeHtml(column.label)}</th>
    `).join('');

const renderTableRows = (columns: DocumentColumn[], rows: string[][]) =>
    rows.map((row) => `
        <tr>
            ${columns.map((column, index) => `
                <td class="align-${column.align ?? 'left'}">${escapeHtml(row[index] ?? '-')}</td>
            `).join('')}
        </tr>
    `).join('');

const renderSections = (sections: DocumentSection[]) =>
    sections.map((section) => `
        <section class="section">
            <div class="section-head">
                <div>
                    <h2>${escapeHtml(section.title)}</h2>
                    ${section.caption ? `<p>${escapeHtml(section.caption)}</p>` : ''}
                </div>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>${renderTableHeader(section.columns)}</tr>
                    </thead>
                    <tbody>
                        ${renderTableRows(section.columns, section.rows)}
                    </tbody>
                </table>
            </div>
            ${section.footerMetrics && section.footerMetrics.length > 0 ? `
                <div class="footer-metrics">
                    ${renderMetricCards(section.footerMetrics)}
                </div>
            ` : ''}
        </section>
    `).join('');

const renderDocumentNote = (documentKind: ReportDocumentInput['documentKind']) => {
    if (documentKind === 'gst-summary') {
        return 'Prepared for GST review. Verify values against return-working data before filing.';
    }
    if (documentKind === 'trial-balance') {
        return 'Prepared for internal accounting review. Confirm ledger postings before statutory use.';
    }
    if (documentKind === 'balance-sheet') {
        return 'Prepared from current ledger balances. Reconcile supporting schedules before final submission.';
    }
    return 'Prepared for business review and export.';
};

export const createReportDocumentHtml = ({
    title,
    subtitle,
    businessName,
    contextLabel,
    documentKind = 'generic',
    summaryMetrics = [],
    sections,
}: ReportDocumentInput) => {
    const generatedAt = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            color-scheme: light;
            --ink: #152235;
            --muted: #63728b;
            --border: #d8e0ec;
            --surface: #ffffff;
            --surface-alt: #f4f7fb;
            --brand: #315ddc;
            --brand-soft: rgba(49, 93, 220, 0.08);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: #edf2f8;
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 24px;
        }
        .sheet {
            max-width: 980px;
            margin: 0 auto;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 28px;
            padding: 28px;
        }
        .head {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 24px;
        }
        .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand);
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        h1 {
            margin: 0;
            font-size: 28px;
            line-height: 1.1;
        }
        .subtitle {
            margin: 8px 0 0;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.5;
        }
        .meta {
            text-align: right;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.6;
            min-width: 180px;
        }
        .summary-grid,
        .footer-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }
        .summary-grid {
            margin-bottom: 20px;
        }
        .note-card {
            margin-bottom: 18px;
            padding: 12px 14px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: linear-gradient(180deg, rgba(49, 93, 220, 0.06), rgba(49, 93, 220, 0.02));
            color: var(--muted);
            font-size: 12px;
            line-height: 1.6;
        }
        .metric-card {
            border: 1px solid var(--border);
            background: var(--surface-alt);
            border-radius: 18px;
            padding: 12px 14px;
        }
        .metric-label {
            color: var(--muted);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .metric-value {
            margin-top: 4px;
            font-size: 18px;
            font-weight: 800;
        }
        .section {
            margin-top: 22px;
        }
        .section-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-end;
            margin-bottom: 10px;
        }
        .section h2 {
            margin: 0;
            font-size: 18px;
        }
        .section p {
            margin: 4px 0 0;
            color: var(--muted);
            font-size: 13px;
        }
        .table-wrap {
            border: 1px solid var(--border);
            border-radius: 20px;
            overflow: hidden;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead {
            background: var(--surface-alt);
        }
        tbody {
            background: #ffffff;
        }
        tbody tr:nth-child(even) {
            background: rgba(21, 34, 53, 0.025);
        }
        th,
        td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            font-size: 13px;
        }
        tr:last-child td {
            border-bottom: none;
        }
        th {
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            text-align: left;
        }
        .align-left { text-align: left; }
        .align-center { text-align: center; }
        .align-right { text-align: right; }
        .footer-metrics {
            margin-top: 12px;
        }
        @media print {
            body {
                background: #ffffff;
                padding: 0;
            }
            .sheet {
                border: none;
                border-radius: 0;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <main class="sheet">
        <header class="head">
            <div>
                ${contextLabel ? `<div class="eyebrow">${escapeHtml(contextLabel)}</div>` : ''}
                <h1>${escapeHtml(title)}</h1>
                ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
            </div>
            <div class="meta">
                ${businessName ? `<div><strong>${escapeHtml(businessName)}</strong></div>` : ''}
                <div>Generated ${escapeHtml(generatedAt)}</div>
            </div>
        </header>
        <section class="note-card">${escapeHtml(renderDocumentNote(documentKind))}</section>
        ${summaryMetrics.length > 0 ? `<section class="summary-grid">${renderMetricCards(summaryMetrics)}</section>` : ''}
        ${renderSections(sections)}
    </main>
</body>
</html>`;
};

export const exportReportDocument = async ({
    shareTitle,
    ...document
}: ExportReportDocumentInput) => {
    const html = createReportDocumentHtml(document);

    if (Platform.OS === 'web') {
        await printAsync({ html });
        return { mode: 'print' as const };
    }

    const { uri } = await printToFileAsync({ html });
    if (await isAvailableAsync()) {
        await shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: shareTitle ?? document.title,
        });
        return { mode: 'share' as const, uri };
    }

    await Share.share({
        title: shareTitle ?? document.title,
        message: `${shareTitle ?? document.title}\n${uri}`,
        url: uri,
    });
    return { mode: 'share' as const, uri };
};
