import { Config } from '../constants/Config';
import type { Bill } from '../types';
import { formatCurrency, formatDate } from './formatters';

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const asString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return fallback;
};

const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

type BillLine = {
    name: string;
    hsn: string;
    qty: number;
    rate: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
};

const normalizeBillLines = (bill: Bill): BillLine[] => {
    return bill.items.map((rawLine) => {
        const line = asRecord(rawLine);
        const qty = Math.max(0, asNumber(line.quantity) ?? 0);
        const rate = Math.max(0, asNumber(line.price) ?? 0);
        const discount = Math.max(0, asNumber(line.discount) ?? 0);
        const taxRate = Math.max(0, asNumber(line.tax) ?? 0);
        const baseBeforeTax = Math.max(0, (qty * rate) - discount);
        const taxAmount = (baseBeforeTax * taxRate) / 100;
        const computedTotal = baseBeforeTax + taxAmount;
        const providedTotal = asNumber(line.total);

        return {
            name: asString(line.name, 'Item'),
            hsn: asString(line.hsn, '-'),
            qty,
            rate,
            discount,
            taxRate,
            taxAmount,
            total: providedTotal ?? computedTotal,
        };
    });
};

const renderThermalBillHTML = (bill: Bill, data: Record<string, unknown>) => {
    const businessName = escapeHtml(asString(bill.businessName, Config.companyName));
    const businessAddress = escapeHtml(asString(bill.businessAddress, Config.companyAddress));
    const gstNumber = escapeHtml(asString(bill.gstNumber, 'Not Set'));
    const currency = bill.currency ?? Config.defaultCurrency;
    const billNumber = escapeHtml(bill.billNumber?.trim() || (bill.id ? bill.id.slice(0, 8).toUpperCase() : '-'));
    const billDate = bill.billDate ?? bill.createdAt;
    const paymentMode = escapeHtml(asString(data.paymentMode, 'Cash'));
    const customerName = escapeHtml(asString(bill.customerName, '-'));
    const lines = normalizeBillLines(bill);
    const totalItems = lines.reduce((sum, line) => sum + line.qty, 0);
    const subtotal = lines.reduce((sum, line) => sum + (line.qty * line.rate), 0);
    const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
    const taxTotal = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalValue = Number.isFinite(bill.total) ? bill.total : subtotal - discountTotal + taxTotal;
    const footerText = escapeHtml(asString(data.footerText, 'Thank you, visit again.'));

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 8px;
            background: #ffffff;
            color: #111827;
            font-family: "Courier New", Courier, monospace;
          }
          .receipt {
            width: 100%;
            max-width: 292px;
            margin: 0 auto;
            border: 1px dashed #9ca3af;
            padding: 10px;
          }
          .center { text-align: center; }
          .title { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
          .meta { font-size: 11px; margin: 2px 0; }
          .line { border-top: 1px dashed #9ca3af; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; font-weight: 700; padding-bottom: 4px; }
          td { padding: 2px 0; vertical-align: top; }
          .t-right { text-align: right; }
          .summary-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
          .summary-total { font-weight: 700; font-size: 13px; margin-top: 6px; }
          .footer { margin-top: 8px; font-size: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center title">${businessName}</div>
          <div class="center meta">${businessAddress}</div>
          <div class="center meta">GSTIN: ${gstNumber}</div>
          <div class="center meta">Bill No: ${billNumber}</div>
          <div class="center meta">${escapeHtml(formatDate(billDate))} - ${paymentMode}</div>
          <div class="line"></div>
          <div class="meta">Customer: ${customerName}</div>
          <div class="line"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="t-right">Qty</th>
                <th class="t-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((line) => `
                <tr>
                  <td>${escapeHtml(line.name)}</td>
                  <td class="t-right">${line.qty}</td>
                  <td class="t-right">${formatCurrency(line.total, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="line"></div>
          <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(subtotal, currency)}</span></div>
          <div class="summary-row"><span>Discount</span><span>${formatCurrency(discountTotal, currency)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${formatCurrency(taxTotal, currency)}</span></div>
          <div class="summary-row"><span>Total Items</span><span>${totalItems}</span></div>
          <div class="summary-row summary-total"><span>TOTAL</span><span>${formatCurrency(totalValue, currency)}</span></div>
          <div class="line"></div>
          <div class="footer">${footerText}</div>
          <div class="footer">Computer Generated Receipt</div>
        </div>
      </body>
    </html>
    `;
};

const renderA4BillHTML = (bill: Bill, data: Record<string, unknown>) => {
    const businessName = escapeHtml(asString(bill.businessName, Config.companyName));
    const businessAddress = escapeHtml(asString(bill.businessAddress, Config.companyAddress));
    const gstNumber = escapeHtml(asString(bill.gstNumber, 'Not Set'));
    const currency = bill.currency ?? Config.defaultCurrency;
    const billNumber = escapeHtml(bill.billNumber?.trim() || (bill.id ? bill.id.slice(0, 8).toUpperCase() : '-'));
    const billDate = bill.billDate ?? bill.createdAt;
    const customerName = escapeHtml(asString(bill.customerName, '-'));
    const customerPhone = escapeHtml(asString(bill.customerPhone, '-'));
    const customerAddress = escapeHtml(asString(data.customerAddress, '-'));
    const paymentMode = escapeHtml(asString(data.paymentMode, 'Cash'));
    const footerText = escapeHtml(asString(data.footerText, 'Subject to local jurisdiction.'));
    const acknowledgmentText = escapeHtml(asString(data.acknowledgmentText, 'Thank you for your business.'));
    const upiId = escapeHtml(asString(data.upiId, ''));
    const qrImageDataUrl = asString(data.qrImageDataUrl, '');
    const signatureImageUrl = asString(data.signatureImageUrl, '');
    const invoiceTitle = bill.billMode === 'ESTIMATE' ? 'ESTIMATE / QUOTATION' : 'TAX INVOICE';

    const lines = normalizeBillLines(bill);
    const totalItems = lines.reduce((sum, line) => sum + line.qty, 0);
    const subtotal = lines.reduce((sum, line) => sum + (line.qty * line.rate), 0);
    const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
    const taxTotalFromLines = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const externalTaxTotal = asNumber(data.taxAmount);
    const taxTotal = externalTaxTotal ?? taxTotalFromLines;
    const taxableValue = Math.max(0, subtotal - discountTotal);

    const providedCgst = asNumber(data.cgstAmount);
    const providedSgst = asNumber(data.sgstAmount);
    const providedIgst = asNumber(data.igstAmount);
    const hasSplitGst = providedCgst !== null || providedSgst !== null;
    const cgstAmount = providedCgst ?? (hasSplitGst ? 0 : 0);
    const sgstAmount = providedSgst ?? (hasSplitGst ? 0 : 0);
    const igstAmount = providedIgst ?? (hasSplitGst ? 0 : taxTotal);
    const totalValue = Number.isFinite(bill.total) ? bill.total : taxableValue + taxTotal;

    const qrMarkup = qrImageDataUrl.trim()
        ? `<img class="qr-image" src="${qrImageDataUrl}" alt="UPI QR" />`
        : `<div class="qr-placeholder">${upiId ? `UPI: ${upiId}` : 'UPI QR'}</div>`;
    const signatureMarkup = signatureImageUrl.trim()
        ? `<img class="signature-image" src="${signatureImageUrl}" alt="Signature" />`
        : `<div class="signature-placeholder">Authorized Signatory</div>`;

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 20px;
            background: #eceff3;
            color: #101828;
            font-family: "Segoe UI", Arial, sans-serif;
          }
          .sheet {
            max-width: 980px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #d0d5dd;
            padding: 16px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 14px;
          }
          .brand {
            display: flex;
            gap: 10px;
            flex: 1;
          }
          .logo {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            border: 1px solid #98a2b3;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
          }
          .brand-title {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            line-height: 1.1;
          }
          .brand-meta {
            margin: 2px 0 0;
            color: #475467;
            font-size: 12px;
          }
          .cod-box {
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 8px 10px;
            min-width: 220px;
            font-size: 13px;
            font-weight: 700;
          }
          .title-row {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .title {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.2px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(180px, 1fr));
            gap: 6px 14px;
            margin-top: 10px;
            font-size: 12px;
          }
          .party-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
          }
          .party-box {
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 10px;
          }
          .party-heading {
            margin: 0 0 5px;
            font-size: 12px;
            color: #475467;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .party-name {
            margin: 0 0 4px;
            font-size: 15px;
            font-weight: 700;
          }
          .party-line {
            margin: 0;
            font-size: 12px;
            color: #344054;
            line-height: 1.35;
          }
          .table-wrap {
            margin-top: 12px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          thead {
            background: #f2f4f7;
          }
          th {
            text-align: left;
            padding: 8px;
            font-size: 11px;
            text-transform: uppercase;
            color: #475467;
          }
          td {
            padding: 8px;
            border-top: 1px solid #eaecf0;
            vertical-align: top;
          }
          .num { text-align: right; white-space: nowrap; }
          .totals-grid {
            margin-top: 12px;
            display: grid;
            grid-template-columns: 1fr 290px;
            gap: 12px;
            align-items: start;
          }
          .notes {
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 10px;
            font-size: 12px;
            color: #344054;
            line-height: 1.45;
          }
          .summary {
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 10px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 12px;
          }
          .summary-total {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #d0d5dd;
            font-size: 15px;
            font-weight: 800;
          }
          .bottom-row {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-end;
          }
          .payment-box {
            flex: 1;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 8px;
            min-height: 104px;
          }
          .payment-title {
            margin: 0 0 6px;
            font-size: 12px;
            font-weight: 700;
            color: #475467;
          }
          .qr-wrap {
            width: 104px;
            height: 104px;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #fafafa;
          }
          .qr-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .qr-placeholder {
            text-align: center;
            font-size: 11px;
            color: #475467;
            padding: 8px;
            line-height: 1.3;
          }
          .signature-wrap {
            width: 180px;
            text-align: center;
          }
          .signature-image {
            width: 100%;
            max-height: 54px;
            object-fit: contain;
            border-bottom: 1px solid #d0d5dd;
            padding-bottom: 4px;
          }
          .signature-placeholder {
            width: 100%;
            height: 54px;
            border-bottom: 1px solid #d0d5dd;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #667085;
            font-size: 11px;
          }
          .footer {
            margin-top: 10px;
            text-align: center;
            font-size: 11px;
            color: #667085;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="brand">
              <div class="logo">${escapeHtml(businessName.slice(0, 1).toUpperCase())}</div>
              <div>
                <p class="brand-title">${businessName}</p>
                <p class="brand-meta">${businessAddress}</p>
                <p class="brand-meta">GSTIN: ${gstNumber}</p>
              </div>
            </div>
            <div class="cod-box">Mode: ${escapeHtml(paymentMode)}<br/>Amount: ${formatCurrency(totalValue, currency)}</div>
          </div>

          <div class="title-row">
            <h2 class="title">${escapeHtml(invoiceTitle)}</h2>
            <div class="meta-grid">
              <div><strong>Invoice No:</strong> ${billNumber}</div>
              <div><strong>Date:</strong> ${escapeHtml(formatDate(billDate))}</div>
              <div><strong>Payment Mode:</strong> ${escapeHtml(paymentMode)}</div>
              <div>Total Items: ${totalItems}</div>
            </div>
          </div>

          <div class="party-grid">
            <div class="party-box">
              <p class="party-heading">Bill To</p>
              <p class="party-name">${customerName}</p>
              <p class="party-line">Phone: ${customerPhone}</p>
              <p class="party-line">${customerAddress}</p>
            </div>
            <div class="party-box">
              <p class="party-heading">Ship To</p>
              <p class="party-name">${customerName}</p>
              <p class="party-line">${customerAddress}</p>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN</th>
                  <th class="num">Qty</th>
                  <th class="num">Rate</th>
                  <th class="num">Discount</th>
                  <th class="num">Tax</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lines.map((line) => `
                  <tr>
                    <td>${escapeHtml(line.name)}</td>
                    <td>${escapeHtml(line.hsn)}</td>
                    <td class="num">${line.qty}</td>
                    <td class="num">${formatCurrency(line.rate, currency)}</td>
                    <td class="num">${formatCurrency(line.discount, currency)}</td>
                    <td class="num">${line.taxRate.toFixed(2)}%</td>
                    <td class="num">${formatCurrency(line.total, currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="totals-grid">
            <div class="notes">
              ${acknowledgmentText}<br/><br/>
              ${footerText}
            </div>
            <div class="summary">
              <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(subtotal, currency)}</span></div>
              <div class="summary-row"><span>Discount</span><span>${formatCurrency(discountTotal, currency)}</span></div>
              <div class="summary-row"><span>Taxable Value</span><span>${formatCurrency(taxableValue, currency)}</span></div>
              <div class="summary-row"><span>CGST</span><span>${formatCurrency(cgstAmount, currency)}</span></div>
              <div class="summary-row"><span>SGST</span><span>${formatCurrency(sgstAmount, currency)}</span></div>
              <div class="summary-row"><span>IGST</span><span>${formatCurrency(igstAmount, currency)}</span></div>
              <div class="summary-row"><span>Tax Total</span><span>${formatCurrency(taxTotal, currency)}</span></div>
              <div class="summary-row summary-total"><span>TOTAL</span><span>${formatCurrency(totalValue, currency)}</span></div>
            </div>
          </div>

          <div class="bottom-row">
            <div class="payment-box">
              <p class="payment-title">Pay using UPI</p>
              <div class="qr-wrap">${qrMarkup}</div>
            </div>
            <div class="signature-wrap">
              ${signatureMarkup}
              <div class="footer">Authorized Signature</div>
            </div>
          </div>

          <div class="footer">Computer Generated Invoice - ${businessName}</div>
        </div>
      </body>
    </html>
    `;
};

export const generateBillHTML = (bill: Bill) => {
    const data = asRecord(bill);
    const printerType = asString(data.printerType).toUpperCase();
    const paperSize = asString(data.paperSize).toUpperCase();
    const thermalMode = printerType === 'THERMAL' || paperSize === '2INCH' || paperSize === '3INCH';

    if (thermalMode) {
        return renderThermalBillHTML(bill, data);
    }

    return renderA4BillHTML(bill, data);
};
