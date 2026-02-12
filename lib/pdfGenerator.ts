import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../types';

export const generateInvoicePDF = async (transaction: any) => {
    const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            .meta { font-size: 14px; color: #555; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="header">
            <div class="title">INVOICE</div>
            <div>BillTap Business</div>
        </div>
        
        <div class="meta">
            <div>Date: ${new Date(transaction.createdAt).toLocaleDateString()}</div>
            <div>Customer: ${transaction.customerName || 'N/A'}</div>
            <div>Phone: ${transaction.customerPhone || 'N/A'}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${transaction.items.map((item: any) => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${item.sellingPrice}</td>
                        <td>${item.sellingPrice * item.quantity}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="total">
            Total: ₹${transaction.totalAmount}
        </div>
      </body>
    </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    return uri;
};
