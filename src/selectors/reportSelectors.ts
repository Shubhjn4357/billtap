import type { SelectOption } from '../components/ui/SelectField';
import type { OfflineReportSummary } from '../repositories/reportRepository';

export type NormalizedGstRow = {
    gstRate: number;
    taxableTurnover: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
};

export type LedgerEntryLike = {
    id: string;
    voucherType: string;
    voucherNumber: string;
    date: string;
    narration: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
};

const asNumber = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const formatInr = (value: number, maximumFractionDigits = 2) =>
    `Rs ${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits })}`;

export const formatReportDate = (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN');
};

export const normalizePnlSummary = (value: unknown): OfflineReportSummary => {
    const summary = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return {
        totalSales: asNumber(summary.totalSales),
        totalPurchases: asNumber(summary.totalPurchases),
        grossProfit: asNumber(summary.grossProfit),
        totalExpenses: asNumber(summary.totalExpenses),
        netProfit: asNumber(summary.netProfit),
        totalTaxCollected: asNumber(summary.totalTaxCollected),
        outstandingReceivables: asNumber(summary.outstandingReceivables),
        outstandingPayables: asNumber(summary.outstandingPayables),
    };
};

export const normalizeGstRows = (rows: unknown[]): NormalizedGstRow[] =>
    rows.map((row) => {
        const entry = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        const gstRate = asNumber(entry.gstRate ?? entry.rate);
        const taxableTurnover = asNumber(entry.taxableTurnover ?? entry.taxable ?? entry.totalTaxable);
        const cgstAmount = asNumber(entry.cgstAmount ?? entry.cgst);
        const sgstAmount = asNumber(entry.sgstAmount ?? entry.sgst);
        const igstAmount = asNumber(entry.igstAmount ?? entry.igst);
        const totalTax = asNumber(entry.totalTax ?? entry.taxAmount ?? (cgstAmount + sgstAmount + igstAmount));
        return {
            gstRate,
            taxableTurnover,
            cgstAmount,
            sgstAmount,
            igstAmount,
            totalTax,
        };
    });

export const summarizeGstRows = (rows: NormalizedGstRow[]) =>
    rows.reduce(
        (acc, row) => ({
            taxable: acc.taxable + row.taxableTurnover,
            tax: acc.tax + row.totalTax,
            cgst: acc.cgst + row.cgstAmount,
            sgst: acc.sgst + row.sgstAmount,
            igst: acc.igst + row.igstAmount,
        }),
        { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 }
    );

export const shiftMonthYear = (month: number, year: number, delta: number) => {
    const base = new Date(year, month - 1, 1);
    base.setMonth(base.getMonth() + delta);
    return {
        month: base.getMonth() + 1,
        year: base.getFullYear(),
    };
};

export const formatMonthYear = (month: number, year: number) =>
    `${String(month).padStart(2, '0')}/${year}`;

export const buildLedgerVoucherOptions = (entries: LedgerEntryLike[]): SelectOption[] => {
    const unique = Array.from(new Set(entries.map((entry) => entry.voucherType))).filter(Boolean);
    return unique.map((voucher) => ({
        label: voucher.replaceAll('_', ' '),
        value: voucher,
        description: `Filter ${voucher.replaceAll('_', ' ')} transactions`,
    }));
};

export const filterLedgerEntries = (
    entries: LedgerEntryLike[],
    filters: { fromDate?: string | null; toDate?: string | null; voucherType?: string | null }
) => {
    const from = filters.fromDate ? new Date(filters.fromDate) : null;
    const to = filters.toDate ? new Date(filters.toDate) : null;
    const voucher = String(filters.voucherType ?? '').trim().toUpperCase();

    return entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        if (from && !Number.isNaN(from.getTime()) && entryDate < from) return false;
        if (to && !Number.isNaN(to.getTime())) {
            const toInclusive = new Date(to);
            toInclusive.setHours(23, 59, 59, 999);
            if (entryDate > toInclusive) return false;
        }
        if (voucher && !entry.voucherType.toUpperCase().includes(voucher)) return false;
        return true;
    });
};
