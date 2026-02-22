import { describe, expect, it } from 'vitest';
import { generateSalesReportHTML } from './reportTemplate';

describe('generateSalesReportHTML', () => {
    it('renders summary and line items', () => {
        const html = generateSalesReportHTML({
            rangeLabel: '7D',
            totalRevenue: 1200,
            totalOrders: 2,
            currency: 'INR',
            topItems: [{ name: 'Pen', qty: 10, revenue: 100 }],
            bills: [
                {
                    id: 'abcd1234',
                    userId: 'u1',
                    items: [{ id: '1', name: 'Pen', price: 10, quantity: 5 }],
                    total: 50,
                    createdAt: new Date(2026, 1, 13).toISOString(),
                },
            ],
        });

        expect(html).toContain('Sales Report');
        expect(html).toContain('Top Products');
        expect(html).toContain('Pen');
        expect(html).toContain('ABCD1234');
    });
});
