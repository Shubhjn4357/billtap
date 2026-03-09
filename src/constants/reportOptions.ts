import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import type { OfflineReportSummary } from '../repositories/reportRepository';

type IconName = string;
type MetricTone = 'success' | 'warning' | 'primary' | 'error' | 'neutral';
export type ReportTone = 'primary' | 'success' | 'warning' | 'info';
export type LedgerTypeFilter = 'ALL' | 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
export type LedgerSortKey = 'name_asc' | 'balance_asc' | 'balance_desc';
export type ReportCard = {
    title: string;
    subtitle: string;
    route: string;
    icon: IconName;
    category: string;
    tone: ReportTone;
};

export type PnlMetricOption = {
    label: string;
    key: keyof OfflineReportSummary;
    icon: IconName;
    tone: MetricTone;
};

export const getPnlRangePresets = (today = new Date()) => {
    const currentFinancialYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return [
        {
            label: 'This Month',
            from: format(startOfMonth(today), 'yyyy-MM-dd'),
            to: format(endOfMonth(today), 'yyyy-MM-dd'),
        },
        {
            label: 'Last Month',
            from: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
            to: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
        },
        {
            label: 'Last 3 Months',
            from: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
            to: format(endOfMonth(today), 'yyyy-MM-dd'),
        },
        {
            label: 'This Year',
            from: `${currentFinancialYear}-04-01`,
            to: `${currentFinancialYear + 1}-03-31`,
        },
    ] as const;
};

export const PNL_METRIC_OPTIONS: PnlMetricOption[] = [
    { label: 'Total Sales', key: 'totalSales', icon: 'chart-line-variant', tone: 'success' },
    { label: 'Total Purchases', key: 'totalPurchases', icon: 'package-variant-closed', tone: 'warning' },
    { label: 'Gross Profit', key: 'grossProfit', icon: 'diamond-stone', tone: 'primary' },
    { label: 'Total Expenses', key: 'totalExpenses', icon: 'cash-minus', tone: 'error' },
    { label: 'Net Profit', key: 'netProfit', icon: 'trophy-outline', tone: 'success' },
    { label: 'Tax Collected', key: 'totalTaxCollected', icon: 'bank-outline', tone: 'neutral' },
    { label: 'Receivables', key: 'outstandingReceivables', icon: 'arrow-up-bold-circle-outline', tone: 'success' },
    { label: 'Payables', key: 'outstandingPayables', icon: 'arrow-down-bold-circle-outline', tone: 'error' },
];

export const GST_PERIOD_OPTIONS = [
    { key: 'current', label: 'Current Month', icon: 'calendar-month-outline' as IconName },
    { key: 'last', label: 'Last Month', icon: 'history' as IconName },
] as const;

export const LEDGER_TYPE_LABELS: Record<LedgerTypeFilter, string> = {
    ALL: 'All',
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    INCOME: 'Income',
    EXPENSE: 'Expenses',
    EQUITY: 'Equity',
};

export const LEDGER_TYPE_FILTER_OPTIONS: { key: LedgerTypeFilter; icon: IconName }[] = [
    { key: 'ALL', icon: 'view-list-outline' },
    { key: 'ASSET', icon: 'cash-plus' },
    { key: 'LIABILITY', icon: 'cash-minus' },
    { key: 'INCOME', icon: 'trending-up' },
    { key: 'EXPENSE', icon: 'trending-down' },
    { key: 'EQUITY', icon: 'scale-balance' },
];

export const LEDGER_SORT_OPTIONS: { key: LedgerSortKey; label: string }[] = [
    { key: 'name_asc', label: 'Name A-Z' },
    { key: 'balance_desc', label: 'Balance Down' },
    { key: 'balance_asc', label: 'Balance Up' },
];

export const REPORT_CARDS = [
    {
        title: 'Profit and Loss',
        subtitle: 'Income, expense and net result',
        route: '/(main)/more/reports/pnl',
        icon: 'chart-areaspline',
        category: 'Financial',
        tone: 'success',
    },
    {
        title: 'GST Summary',
        subtitle: 'Slab-wise taxable turnover and tax',
        route: '/(main)/reports/gst-summary',
        icon: 'bank-outline',
        category: 'Tax',
        tone: 'primary',
    },
    {
        title: 'Trial Balance',
        subtitle: 'Debit and credit integrity check',
        route: '/(main)/reports/trial-balance',
        icon: 'scale-balance',
        category: 'Accounting',
        tone: 'warning',
    },
    {
        title: 'Ledgers',
        subtitle: 'Drill down voucher-level transactions',
        route: '/(main)/reports/ledgers',
        icon: 'book-open-page-variant-outline',
        category: 'Accounting',
        tone: 'info',
    },
    {
        title: 'Inventory',
        subtitle: 'Stock valuation and movement reports',
        route: '/(main)/inventory',
        icon: 'archive-outline',
        category: 'Stock',
        tone: 'primary',
    },
    {
        title: 'Screen Directory',
        subtitle: 'Open all screens and flows',
        route: '/(main)/more/screen-directory',
        icon: 'compass-outline',
        category: 'Utility',
        tone: 'info',
    },
] as const satisfies readonly ReportCard[];
