import { describe, expect, it } from 'vitest';
import type { Bill } from '../types';
import { generateBillHTML } from './billTemplate';

describe('generateBillHTML', () => {
    const bill: Bill = {
        id: 'abcd1234efgh5678',
        userId: 'user-1',
        businessName: 'Test Store',
        businessAddress: 'Somewhere Street',
        gstNumber: 'GST123',
        currency: 'INR',
        customerName: 'Alice',
        customerPhone: '9999999999',
        items: [
            { id: '1', name: 'Pen', price: 10, quantity: 2 },
            { id: '2', name: 'Notebook', price: 50, quantity: 1 },
        ],
        total: 70,
        createdAt: new Date(2026, 1, 13, 12, 0, 0),
    };

    it('includes business and customer metadata', () => {
        const html = generateBillHTML(bill);
        expect(html).toContain('Test Store');
        expect(html).toContain('Somewhere Street');
        expect(html).toContain('GST123');
        expect(html).toContain('Alice');
    });

    it('renders line items and totals', () => {
        const html = generateBillHTML(bill);
        expect(html).toContain('Pen');
        expect(html).toContain('Notebook');
        expect(html).toContain('Total Items: 3');
    });
});
