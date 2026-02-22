import { describe, expect, it } from 'vitest';
import type { StoredBill } from '../api/billService';
import { calculateBillStats } from './billStats';

describe('calculateBillStats', () => {
    it('computes totals, today and weekly metrics', () => {
        const reference = new Date(2026, 1, 13, 12, 0, 0);
        const bills: StoredBill[] = [
            {
                id: '1',
                userId: 'u',
                items: [],
                total: 100,
                createdAt: new Date(2026, 1, 13, 10, 0, 0).toISOString(),
            },
            {
                id: '2',
                userId: 'u',
                items: [],
                total: 200,
                createdAt: new Date(2026, 1, 10, 10, 0, 0).toISOString(),
            },
            {
                id: '3',
                userId: 'u',
                items: [],
                total: 50,
                createdAt: new Date(2026, 0, 30, 10, 0, 0).toISOString(),
            },
        ];

        const stats = calculateBillStats(bills, reference);
        expect(stats.todaySales).toBe(100);
        expect(stats.todayOrders).toBe(1);
        expect(stats.weeklySales).toBe(300);
        expect(stats.totalRevenue).toBe(350);
        expect(stats.totalOrders).toBe(3);
        expect(stats.averageOrderValue).toBeCloseTo(116.666, 2);
    });
});
