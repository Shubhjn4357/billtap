import type { StoredBill } from '../api/billService';

const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const candidate = value as { toDate: () => Date };
        return candidate.toDate();
    }
    return null;
};

export interface BillStats {
    todaySales: number;
    todayOrders: number;
    weeklySales: number;
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
}

export const calculateBillStats = (bills: StoredBill[], referenceDate = new Date()): BillStats => {
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 6);

    let todaySales = 0;
    let todayOrders = 0;
    let weeklySales = 0;

    for (const bill of bills) {
        const createdAt = toDate(bill.createdAt);
        if (!createdAt) continue;

        if (createdAt >= today) {
            todaySales += bill.total;
            todayOrders += 1;
        }

        if (createdAt >= last7Days) {
            weeklySales += bill.total;
        }
    }

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalOrders = bills.length;

    return {
        todaySales,
        todayOrders,
        weeklySales,
        totalRevenue,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
};
