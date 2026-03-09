import type { Invoice } from '../types/domain';
import type { AppLanguage, InvoiceTemplateMode } from '../constants/appPreferences';
import { translateAppCopy } from '../constants/appCopy';

export interface InvoicePrintConfig {
    printLayoutType: 'REGULAR' | 'THERMAL';
    printTextSize: 'SMALL' | 'MEDIUM' | 'LARGE';
    pageSize: string;
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    printCompanyInfo: boolean;
    printCompanyName: boolean;
    printCompanyLogo: boolean;
    printAddressEmailPhone: boolean;
    printGstinOnSale: boolean;
    printTaxDetailsBreakup: boolean;
    printDescription: boolean;
    printTermsAndConditions: boolean;
    printSignatureText: boolean;
    printSignatureImage?: boolean;
    customSignatureText: string;
    printPaymentMode: boolean;
    printReceivedAmount: boolean;
    printBalanceAmount: boolean;
    printTotalItemQuantity: boolean;
    printPageNumbers: boolean;
    printAmountWithDecimal: boolean;
}

export interface InvoiceHtmlExtras {
    qrImageUrl?: string;
    upiId?: string;
    dueAmount?: number;
    currencyCode?: string;
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    businessGstin?: string;
    businessLogoUrl?: string;
    signatureImageUrl?: string;
    printConfig?: InvoicePrintConfig;
    language?: AppLanguage;
    templateMode?: InvoiceTemplateMode;
}

export const DEFAULT_INVOICE_PRINT_CONFIG: InvoicePrintConfig = {
    printLayoutType: 'REGULAR',
    printTextSize: 'MEDIUM',
    pageSize: 'A4',
    orientation: 'PORTRAIT',
    printCompanyInfo: true,
    printCompanyName: true,
    printCompanyLogo: false,
    printAddressEmailPhone: true,
    printGstinOnSale: true,
    printTaxDetailsBreakup: true,
    printDescription: true,
    printTermsAndConditions: false,
    printSignatureText: false,
    printSignatureImage: false,
    customSignatureText: '',
    printPaymentMode: false,
    printReceivedAmount: false,
    printBalanceAmount: false,
    printTotalItemQuantity: false,
    printPageNumbers: true,
    printAmountWithDecimal: true,
};

export function generateInvoiceHtml(invoice: Invoice, extras?: InvoiceHtmlExtras): string {
    const config: InvoicePrintConfig = {
        ...DEFAULT_INVOICE_PRINT_CONFIG,
        ...(extras?.printConfig ?? {}),
    };
    const language = extras?.language ?? 'en';
    const templateMode = extras?.templateMode ?? 'BUSINESS';
    const currency = (extras?.currencyCode ?? 'INR').toUpperCase();
    const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
    const decimals = config.printAmountWithDecimal ? 2 : 0;
    const textSize = config.printTextSize === 'SMALL' ? 11 : config.printTextSize === 'LARGE' ? 15 : 13;
    const dueAmount = Math.max(Number(extras?.dueAmount ?? 0), 0);
    const rawPageSize = String(config.pageSize ?? 'A4').toUpperCase();
    const normalizedPageSize = rawPageSize.includes('80') ? '80mm'
        : rawPageSize.includes('58') ? '58mm'
            : rawPageSize.includes('A6') ? 'A6'
                : rawPageSize.includes('A5') ? 'A5'
                    : 'A4';
    const pageSize = config.printLayoutType === 'THERMAL'
        ? `${normalizedPageSize === '80mm' || normalizedPageSize === '58mm' ? normalizedPageSize : '80mm'} auto`
        : `${normalizedPageSize} ${String(config.orientation ?? 'PORTRAIT').toLowerCase()}`;
    const t = (key: string, params?: Record<string, string | number>) =>
        translateAppCopy(language, key, params);
    const isBranded = templateMode === 'BRANDED';

    const safe = (value: unknown) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const money = (value: number) => {
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value);
        } catch {
            const symbol = currency === 'INR' ? 'Rs ' : `${currency} `;
            return `${symbol}${Number(value ?? 0).toLocaleString(locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`;
        }
    };

    const invoiceLabel = t('invoice.label.invoice');
    const invoiceType = String(invoice.invoiceType ?? 'TAX_INVOICE').replaceAll('_', ' ');
    const invoiceDate = safe(invoice.invoiceDate);
    const totalQuantity = (invoice.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    const invoiceTotal = Number(invoice.totalInvoiceValue ?? 0);
    const receivedAmount = Number(invoice.paidAmount ?? 0);
    const balanceAmount = Math.max(invoiceTotal - receivedAmount, 0);

    const companyInfoSection = config.printCompanyInfo
        ? `
            <div class="company-block">
                ${config.printCompanyLogo && extras?.businessLogoUrl
                    ? `<img src="${safe(extras.businessLogoUrl)}" class="company-logo" />`
                    : ''}
                <div class="company-copy">
                    ${config.printCompanyName
                        ? `<h2>${safe(extras?.businessName || 'Business')}</h2>`
                        : ''}
                    ${config.printAddressEmailPhone
                        ? `
                            ${extras?.businessAddress ? `<p>${safe(extras.businessAddress)}</p>` : ''}
                            ${(extras?.businessPhone || extras?.businessEmail)
                                ? `<p>${safe(extras?.businessPhone || '')}${extras?.businessPhone && extras?.businessEmail ? ' | ' : ''}${safe(extras?.businessEmail || '')}</p>`
                                : ''}
                        `
                        : ''}
                    ${config.printGstinOnSale && extras?.businessGstin
                        ? `<p>GSTIN: ${safe(extras.businessGstin)}</p>`
                        : ''}
                </div>
            </div>
        `
        : '';

    const partySection = invoice.partySnapshot
        ? `
            <div class="detail-card">
                <div class="detail-label">${safe(t('invoice.label.party'))}</div>
                <div class="detail-value">${safe(invoice.partySnapshot.name)}</div>
                ${invoice.partySnapshot.gstin ? `<div class="detail-meta">GSTIN: ${safe(invoice.partySnapshot.gstin)}</div>` : ''}
                ${invoice.partySnapshot.phone ? `<div class="detail-meta">${safe(invoice.partySnapshot.phone)}</div>` : ''}
                ${invoice.partySnapshot.address ? `<div class="detail-meta">${safe(invoice.partySnapshot.address)}</div>` : ''}
            </div>
        `
        : '';

    const detailCards = `
        <div class="detail-grid">
            <div class="detail-card">
                <div class="detail-label">${safe(t('invoice.label.invoice_no'))}</div>
                <div class="detail-value">${safe(invoice.invoiceNumber)}</div>
            </div>
            <div class="detail-card">
                <div class="detail-label">${safe(t('invoice.label.date'))}</div>
                <div class="detail-value">${invoiceDate}</div>
            </div>
            <div class="detail-card">
                <div class="detail-label">${safe(t('invoice.label.status'))}</div>
                <div class="detail-value">${safe(invoice.paymentStatus)}</div>
            </div>
            ${partySection}
        </div>
    `;

    const itemRows = (invoice.items ?? []).map((item) => `
        <tr>
            <td>
                <div class="item-title">${safe(item.description)}</div>
                ${item.unit ? `<div class="item-sub">${safe(item.unit)}</div>` : ''}
            </td>
            <td class="right">${safe(item.quantity)}</td>
            <td class="right">${money(Number(item.rate ?? 0))}</td>
            <td class="right amount">${money(Number(item.total ?? 0))}</td>
        </tr>
    `).join('');

    const taxBreakupSection = config.printTaxDetailsBreakup
        ? `
            <div class="detail-grid tax-grid">
                ${Number(invoice.totalCgstAmount ?? 0) > 0 ? `<div class="mini-stat"><span>CGST</span><strong>${money(Number(invoice.totalCgstAmount ?? 0))}</strong></div>` : ''}
                ${Number(invoice.totalSgstAmount ?? 0) > 0 ? `<div class="mini-stat"><span>SGST</span><strong>${money(Number(invoice.totalSgstAmount ?? 0))}</strong></div>` : ''}
                ${Number(invoice.totalIgstAmount ?? 0) > 0 ? `<div class="mini-stat"><span>IGST</span><strong>${money(Number(invoice.totalIgstAmount ?? 0))}</strong></div>` : ''}
            </div>
        `
        : '';

    const summaryCards = [
        `<div class="summary-card emphasis"><span>${safe(t('invoice.label.invoice_total'))}</span><strong>${money(invoiceTotal)}</strong></div>`,
        config.printReceivedAmount || receivedAmount > 0
            ? `<div class="summary-card"><span>${safe(t('invoice.label.received'))}</span><strong>${money(receivedAmount)}</strong></div>`
            : '',
        config.printBalanceAmount || dueAmount > 0 || balanceAmount > 0
            ? `<div class="summary-card"><span>${safe(t('invoice.label.balance'))}</span><strong>${money(balanceAmount)}</strong></div>`
            : '',
        config.printPaymentMode
            ? `<div class="summary-card"><span>${safe(t('invoice.label.status'))}</span><strong>${safe(invoice.paymentStatus)}</strong></div>`
            : '',
    ].filter(Boolean).join('');

    const qrSection = extras?.qrImageUrl
        ? `
            <div class="qr-card">
                <img src="${safe(extras.qrImageUrl)}" class="qr-image" />
                <div class="qr-copy">
                    ${extras?.upiId ? `<div><span>${safe(t('invoice.label.upi'))}</span><strong>${safe(extras.upiId)}</strong></div>` : ''}
                    <div><span>${safe(t('invoice.label.due'))}</span><strong>${money(dueAmount)}</strong></div>
                </div>
            </div>
        `
        : '';

    const termsSection = config.printTermsAndConditions && invoice.termsAndConditions
        ? `
            <div class="note-card">
                <h3>${safe(t('invoice.label.terms'))}</h3>
                <p>${safe(invoice.termsAndConditions)}</p>
            </div>
        `
        : '';

    const notesSection = config.printDescription && invoice.notes
        ? `
            <div class="note-card">
                <h3>${safe(t('invoice.label.notes'))}</h3>
                <p>${safe(invoice.notes)}</p>
            </div>
        `
        : '';

    const signatureImage = config.printSignatureImage && extras?.signatureImageUrl
        ? `<img src="${safe(extras.signatureImageUrl)}" class="signature-image" />`
        : '';
    const signatureText = config.printSignatureText
        ? `<div class="signature-text">${safe(config.customSignatureText || t('invoice.label.authorized_signatory'))}</div>`
        : '';
    const signatureSection = signatureImage || signatureText
        ? `<div class="signature-block">${signatureImage}${signatureText}</div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${safe(invoiceLabel)}</title>
    <style>
        @page { size: ${pageSize}; margin: 16px; }
        :root {
            --bg: ${isBranded ? '#EAF3FF' : '#FFFFFF'};
            --page: #FFFFFF;
            --surface: ${isBranded ? '#F8FBFF' : '#FAFBFC'};
            --border: ${isBranded ? '#C8DBFF' : '#E5E7EB'};
            --text: #0F172A;
            --muted: #5B6472;
            --accent: ${isBranded ? '#0B78FF' : '#1273EA'};
            --accent-strong: ${isBranded ? '#0C59C9' : '#0F56B3'};
            --accent-soft: ${isBranded ? '#DCEAFE' : '#EAF2FF'};
            --success: #0E9F6E;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: ${textSize}px;
        }
        .page {
            width: 100%;
            background: var(--page);
            border: 1px solid var(--border);
            border-radius: ${isBranded ? 24 : 18}px;
            overflow: hidden;
        }
        .header {
            padding: ${isBranded ? 22 : 18}px ${isBranded ? 22 : 18}px ${isBranded ? 18 : 16}px;
            background: ${isBranded ? 'linear-gradient(135deg, #0B78FF 0%, #0A57C9 100%)' : '#FFFFFF'};
            color: ${isBranded ? '#FFFFFF' : 'var(--text)'};
            border-bottom: 1px solid ${isBranded ? 'rgba(255,255,255,0.18)' : 'var(--border)'};
        }
        .header-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
        }
        .title-wrap {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .eyebrow {
            font-size: ${Math.max(textSize - 3, 10)}px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            opacity: 0.78;
        }
        .title {
            margin: 0;
            font-size: ${textSize + 9}px;
            line-height: ${textSize + 14}px;
            font-weight: 800;
        }
        .title-sub {
            font-size: ${textSize}px;
            line-height: ${textSize + 4}px;
            opacity: ${isBranded ? 0.86 : 0.7};
        }
        .hero-chip {
            min-width: 180px;
            padding: 14px 16px;
            border-radius: 18px;
            background: ${isBranded ? 'rgba(255,255,255,0.14)' : 'var(--accent-soft)'};
            border: 1px solid ${isBranded ? 'rgba(255,255,255,0.18)' : 'var(--border)'};
        }
        .hero-chip span {
            display: block;
            font-size: ${Math.max(textSize - 3, 10)}px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            opacity: 0.78;
        }
        .hero-chip strong {
            display: block;
            margin-top: 4px;
            font-size: ${textSize + 3}px;
            line-height: ${textSize + 8}px;
        }
        .section {
            padding: 18px;
        }
        .company-block {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            margin-bottom: 16px;
        }
        .company-logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
            border-radius: 18px;
            background: rgba(255,255,255,0.94);
            padding: 8px;
        }
        .company-copy h2 {
            margin: 0 0 6px 0;
            font-size: ${textSize + 5}px;
            line-height: ${textSize + 9}px;
        }
        .company-copy p {
            margin: 2px 0;
            color: ${isBranded ? 'rgba(255,255,255,0.88)' : 'var(--muted)'};
        }
        .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }
        .detail-card,
        .summary-card,
        .note-card,
        .qr-card,
        .mini-stat {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
        }
        .detail-card {
            padding: 14px 15px;
        }
        .detail-label,
        .summary-card span,
        .mini-stat span,
        .qr-copy span {
            display: block;
            font-size: ${Math.max(textSize - 3, 10)}px;
            line-height: ${Math.max(textSize, 12)}px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--muted);
        }
        .detail-value {
            margin-top: 5px;
            font-size: ${textSize + 1}px;
            line-height: ${textSize + 5}px;
            font-weight: 700;
        }
        .detail-meta {
            margin-top: 4px;
            color: var(--muted);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead th {
            text-align: left;
            font-size: ${Math.max(textSize - 2, 11)}px;
            font-weight: 800;
            color: ${isBranded ? 'var(--accent-strong)' : 'var(--muted)'};
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 0 12px 10px;
        }
        tbody tr {
            border-top: 1px solid var(--border);
        }
        tbody td {
            padding: 12px;
            vertical-align: top;
        }
        .item-title {
            font-weight: 700;
            line-height: ${textSize + 5}px;
        }
        .item-sub {
            margin-top: 3px;
            color: var(--muted);
            font-size: ${Math.max(textSize - 2, 11)}px;
        }
        .right {
            text-align: right;
        }
        .amount {
            font-weight: 700;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 14px;
        }
        .summary-card {
            padding: 14px 15px;
        }
        .summary-card strong,
        .mini-stat strong,
        .qr-copy strong {
            display: block;
            margin-top: 6px;
            font-size: ${textSize + 2}px;
            line-height: ${textSize + 7}px;
            color: var(--text);
        }
        .summary-card.emphasis {
            background: ${isBranded ? 'linear-gradient(135deg, #E9F3FF 0%, #D7E8FF 100%)' : '#F4F8FF'};
            border-color: ${isBranded ? '#B7D2FF' : '#D5E4FF'};
        }
        .tax-grid {
            margin-top: 12px;
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .mini-stat {
            padding: 12px 14px;
        }
        .footer-grid {
            display: grid;
            grid-template-columns: 1.3fr 0.9fr;
            gap: 14px;
            margin-top: 16px;
        }
        .note-card {
            padding: 14px 15px;
        }
        .note-card h3 {
            margin: 0 0 8px 0;
            font-size: ${textSize}px;
            line-height: ${textSize + 4}px;
        }
        .note-card p {
            margin: 0;
            line-height: ${textSize + 7}px;
            color: var(--muted);
        }
        .qr-card {
            padding: 14px;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .qr-image {
            width: 126px;
            height: 126px;
            object-fit: contain;
            border-radius: 16px;
            background: #FFFFFF;
            padding: 8px;
        }
        .qr-copy {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .signature-block {
            margin-top: 18px;
            text-align: right;
        }
        .signature-image {
            max-width: 160px;
            max-height: 72px;
            object-fit: contain;
            margin-left: auto;
            display: block;
        }
        .signature-text {
            margin-top: 8px;
            color: var(--muted);
            font-weight: 600;
        }
        .footer-note {
            margin-top: 16px;
            color: var(--muted);
            font-size: ${Math.max(textSize - 2, 10)}px;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            ${companyInfoSection}
            <div class="header-row">
                <div class="title-wrap">
                    <div class="eyebrow">${safe(invoiceLabel)}</div>
                    <h1 class="title">${safe(invoiceType)}</h1>
                    <div class="title-sub">${safe(extras?.businessName || '')}</div>
                </div>
                <div class="hero-chip">
                    <span>${safe(t('invoice.label.invoice_total'))}</span>
                    <strong>${money(invoiceTotal)}</strong>
                </div>
            </div>
        </div>

        <div class="section">
            ${detailCards}

            <div style="margin-top: 18px;">
                <table>
                    <thead>
                        <tr>
                            <th>${safe(t('invoice.label.description'))}</th>
                            <th class="right">${safe(t('invoice.label.qty'))}</th>
                            <th class="right">${safe(t('invoice.label.rate'))}</th>
                            <th class="right">${safe(t('invoice.label.amount'))}</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>
            </div>

            ${config.printTotalItemQuantity ? `<div style="margin-top: 12px; color: var(--muted);">${safe(t('invoice.label.total_qty'))}: <strong style="color: var(--text);">${safe(totalQuantity)}</strong></div>` : ''}

            <div class="summary-grid">${summaryCards}</div>
            ${taxBreakupSection}

            <div class="footer-grid">
                <div>
                    ${notesSection}
                    ${termsSection}
                </div>
                <div>
                    ${qrSection}
                    ${signatureSection}
                </div>
            </div>

            ${config.printPageNumbers ? `<div class="footer-note">${safe(t('invoice.label.page'))}</div>` : ''}
        </div>
    </div>
</body>
</html>`;
}
