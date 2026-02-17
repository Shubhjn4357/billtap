import type { StoredBill } from '../api/billService';
import { formatCurrency, formatDate } from './formatters';

export interface SalesReportPayload {
    bills: StoredBill[];
    rangeLabel: string;
    totalRevenue: number;
    totalOrders: number;
    currency: string;
    topItems: {
        name: string;
        qty: number;
        revenue: number;
    }[];
}

export const generateSalesReportHTML = (payload: SalesReportPayload) => {
    const generatedAt = formatDate(new Date());

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #222; }
          h1 { margin: 0 0 6px 0; font-size: 24px; }
          .muted { color: #666; margin: 0 0 18px 0; }
          .grid { display: flex; gap: 12px; margin-bottom: 20px; }
          .card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          .card strong { font-size: 18px; display: block; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border-bottom: 1px solid #eee; padding: 8px 4px; text-align: left; font-size: 13px; }
          .right { text-align: right; }
          .section-title { margin-top: 20px; margin-bottom: 6px; font-size: 16px; }
        </style>
      </head>
      <body>
        <h1>Sales Report</h1>
        <p class="muted">Range: ${payload.rangeLabel} | Generated: ${generatedAt}</p>

        <div class="grid">
          <div class="card">
            Revenue
            <strong>${formatCurrency(payload.totalRevenue, payload.currency)}</strong>
          </div>
          <div class="card">
            Orders
            <strong>${payload.totalOrders}</strong>
          </div>
        </div>

        <div class="section-title">Top Products</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="right">Qty</th>
              <th class="right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${payload.topItems.length === 0 ? `
              <tr>
                <td colspan="3">No product sales in selected range.</td>
              </tr>
            ` : payload.topItems.map((item) => `
              <tr>
                <td>${item.name}</td>
                <td class="right">${item.qty}</td>
                <td class="right">${formatCurrency(item.revenue, payload.currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Orders</div>
        <table>
          <thead>
            <tr>
              <th>Bill ID</th>
              <th>Date</th>
              <th class="right">Items</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${payload.bills.map((bill) => `
              <tr>
                <td>${bill.id.slice(0, 8).toUpperCase()}</td>
                <td>${formatDate(bill.createdAt)}</td>
                <td class="right">${bill.items.length}</td>
                <td class="right">${formatCurrency(bill.total, bill.currency ?? payload.currency)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
    `;
};
