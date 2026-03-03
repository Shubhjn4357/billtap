import type { Invoice } from '../types/domain';

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

    const currency = (extras?.currencyCode ?? 'INR').toUpperCase();
    const decimals = config.printAmountWithDecimal ? 2 : 0;
    const textSize = config.printTextSize === 'SMALL' ? 11 : config.printTextSize === 'LARGE' ? 15 : 13;
    const rawPageSize = String(config.pageSize ?? 'A4').toUpperCase();
    const normalizedPageSize = rawPageSize.includes('80') ? '80mm'
        : rawPageSize.includes('58') ? '58mm'
            : rawPageSize.includes('A6') ? 'A6'
                : rawPageSize.includes('A5') ? 'A5'
                    : 'A4';
    const pageSize = config.printLayoutType === 'THERMAL'
        ? `${normalizedPageSize === '80mm' || normalizedPageSize === '58mm' ? normalizedPageSize : '80mm'} auto`
        : `${normalizedPageSize} ${String(config.orientation ?? 'PORTRAIT').toLowerCase()}`;

    const safe = (value: unknown) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const money = (value: number) => {
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value);
        } catch {
            const symbol = currency === 'INR' ? 'Rs ' : `${currency} `;
            return `${symbol}${Number(value ?? 0).toLocaleString('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}`;
        }
    };

    const itemRows = (invoice.items ?? []).map((item) => `
        <tr>
          <td>${safe(item.description)}</td>
          <td style="text-align:right">${safe(item.quantity)}</td>
          <td style="text-align:right">${money(Number(item.rate ?? 0))}</td>
          <td style="text-align:right">${money(Number(item.total ?? 0))}</td>
        </tr>
    `).join('');

    const totalQuantity = (invoice.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

    const qrSection = extras?.qrImageUrl
        ? `<div style="margin-top:20px;text-align:center;">
             <img src="${safe(extras.qrImageUrl)}" style="width:180px;height:180px;object-fit:contain;" />
             <p style="font-size:${Math.max(textSize - 2, 10)}px;color:#666;">UPI: ${safe(extras.upiId || '')}</p>
             <p style="font-size:${Math.max(textSize - 2, 10)}px;color:#666;">Due: ${money(Number(extras.dueAmount ?? 0))}</p>
           </div>`
        : '';

    const companyInfoSection = config.printCompanyInfo
        ? `<div style="margin-bottom:12px;">
            ${config.printCompanyLogo && extras?.businessLogoUrl ? `<img src="${safe(extras.businessLogoUrl)}" style="width:88px;height:88px;object-fit:contain;margin-bottom:6px;" />` : ''}
            ${config.printCompanyName ? `<h2 style="margin:0 0 4px 0;">${safe(extras?.businessName || 'Business')}</h2>` : ''}
            ${config.printAddressEmailPhone ? `<p style="margin:0;color:#666">${safe(extras?.businessAddress)}</p>
            <p style="margin:0;color:#666">${safe(extras?.businessPhone)} ${extras?.businessEmail ? `| ${safe(extras.businessEmail)}` : ''}</p>` : ''}
            ${config.printGstinOnSale && extras?.businessGstin ? `<p style="margin:0;color:#666">GSTIN: ${safe(extras.businessGstin)}</p>` : ''}
          </div>`
        : '';

    const taxBreakupSection = config.printTaxDetailsBreakup
        ? `<div style="margin-top:10px;">
            ${Number(invoice.totalCgstAmount ?? 0) > 0 ? `<p style="margin:0;">CGST: ${money(Number(invoice.totalCgstAmount ?? 0))}</p>` : ''}
            ${Number(invoice.totalSgstAmount ?? 0) > 0 ? `<p style="margin:0;">SGST: ${money(Number(invoice.totalSgstAmount ?? 0))}</p>` : ''}
            ${Number(invoice.totalIgstAmount ?? 0) > 0 ? `<p style="margin:0;">IGST: ${money(Number(invoice.totalIgstAmount ?? 0))}</p>` : ''}
          </div>`
        : '';

    const paymentMetaSection = `
        ${config.printReceivedAmount ? `<p style="margin:0;">Received: ${money(Number(invoice.paidAmount ?? 0))}</p>` : ''}
        ${config.printBalanceAmount ? `<p style="margin:0;">Balance: ${money(Math.max(Number(invoice.totalInvoiceValue ?? 0) - Number(invoice.paidAmount ?? 0), 0))}</p>` : ''}
        ${config.printPaymentMode ? `<p style="margin:0;">Status: ${safe(invoice.paymentStatus)}</p>` : ''}
    `;

    const signatureImage = config.printSignatureImage && extras?.signatureImageUrl
        ? `<img src="${safe(extras.signatureImageUrl)}" style="max-width:160px;max-height:72px;object-fit:contain;margin-left:auto;display:block;" />`
        : '';
    const signatureText = config.printSignatureText
        ? `<p style="margin:0;color:#666;">${safe(config.customSignatureText || 'Authorized Signatory')}</p>`
        : '';
    const signatureSection = signatureImage || signatureText
        ? `<div style="margin-top:18px;text-align:right;">${signatureImage}${signatureText}</div>`
        : '';

    const termsSection = config.printTermsAndConditions && invoice.termsAndConditions
        ? `<div style="margin-top:12px;"><strong>Terms & Conditions:</strong><p style="margin:4px 0 0 0;">${safe(invoice.termsAndConditions)}</p></div>`
        : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title>
<style>
@page{size:${pageSize}; margin:18px;}
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:0;color:#222;font-size:${textSize}px;}
h1{color:#007B83;margin:0 0 10px 0}
h2{color:#111}
table{width:100%;border-collapse:collapse}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
.right{text-align:right}
.total{font-weight:700;font-size:${textSize + 1}px}
.footer{margin-top:12px;font-size:${Math.max(textSize - 2, 10)}px;color:#666;}
</style>
</head><body>
${companyInfoSection}
<h1>${safe(invoice.invoiceType ?? 'TAX_INVOICE')}</h1>
<p style="margin:0;">Invoice No: ${safe(invoice.invoiceNumber)}</p>
<p style="margin:0;">Date: ${safe(invoice.invoiceDate)}</p>
${invoice.partySnapshot ? `<p style="margin:6px 0 0 0;"><strong>Party:</strong> ${safe(invoice.partySnapshot.name)}</p>` : ''}
<table style="margin-top:12px;">
<thead>
<tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
</thead>
<tbody>${itemRows}</tbody>
</table>
${config.printTotalItemQuantity ? `<p style="margin:8px 0 0 0;">Total Qty: ${safe(totalQuantity)}</p>` : ''}
<p class="total">Invoice Total: ${money(Number(invoice.totalInvoiceValue ?? 0))}</p>
${taxBreakupSection}
${paymentMetaSection}
${qrSection}
${config.printDescription && invoice.notes ? `<p style="margin-top:12px;"><strong>Notes:</strong> ${safe(invoice.notes)}</p>` : ''}
${termsSection}
${signatureSection}
${config.printPageNumbers ? '<div class="footer">Page 1</div>' : ''}
</body></html>`;
}
