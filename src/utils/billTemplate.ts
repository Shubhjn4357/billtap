import { Config } from '../constants/Config';
import type { Bill } from '../types';
import { formatCurrency, formatDate } from './formatters';

export const generateBillHTML = (bill: Bill) => {
    const totalItems = bill.items.reduce((sum, item) => sum + item.quantity, 0);
    const businessName = bill.businessName || Config.companyName;
    const businessAddress = bill.businessAddress || Config.companyAddress;
    const gstNumber = bill.gstNumber || 'Not Set';
    const currency = bill.currency ?? Config.defaultCurrency;
    const billNumber = bill.id ? bill.id.slice(0, 8).toUpperCase() : '-';

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; color: #6750A4; }
          .header p { margin: 5px 0; color: #666; }
          .meta { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; border-bottom: 2px solid #ddd; padding: 10px 5px; font-weight: bold; color: #666; }
          td { padding: 10px 5px; border-bottom: 1px solid #eee; }
          .total-section { text-align: right; margin-top: 20px; }
          .total-row { font-size: 18px; font-weight: bold; color: #6750A4; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${businessName}</h1>
          <p>${businessAddress}</p>
          <p>GSTIN: ${gstNumber}</p>
        </div>

        <div class="meta">
            <div class="meta-row">
                <span><strong>Date:</strong> ${formatDate(bill.createdAt)}</span>
                <span><strong>Bill No:</strong> ${billNumber}</span>
            </div>
            ${bill.customerName ? `
            <div class="meta-row">
                <span><strong>Customer:</strong> ${bill.customerName}</span>
                <span><strong>Phone:</strong> ${bill.customerPhone || '-'}</span>
            </div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td style="text-align: right;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(item.price, currency)}</td>
              <td style="text-align: right;">${formatCurrency(item.price * item.quantity, currency)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
            <div class="total-row">
                Total: ${formatCurrency(bill.total, currency)}
            </div>
            <p>Total Items: ${totalItems}</p>
        </div>

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>Computer Generated Invoice</p>
        </div>
      </body>
    </html>
    `;
};
