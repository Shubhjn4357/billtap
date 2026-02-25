export type AccountingSegmentKey =
    | 'home'
    | 'accounts'
    | 'journal'
    | 'trial'
    | 'profit'
    | 'balance'
    | 'gst'
    | 'inventory';

export interface AccountingSegment {
    key: AccountingSegmentKey;
    label: string;
    route: string;
    icon: string;
}

export const ACCOUNTING_SEGMENTS: AccountingSegment[] = [
    { key: 'home', label: 'Overview', route: '/accounting', icon: 'view-dashboard-outline' },
    { key: 'accounts', label: 'Accounts', route: '/accounting/accounts', icon: 'shape-outline' },
    { key: 'journal', label: 'Journal', route: '/accounting/journal', icon: 'notebook-outline' },
    { key: 'trial', label: 'Trial', route: '/accounting/trial-balance', icon: 'scale-balance' },
    { key: 'profit', label: 'P&L', route: '/accounting/profit-loss', icon: 'chart-line' },
    { key: 'balance', label: 'Balance', route: '/accounting/balance-sheet', icon: 'table-large' },
    { key: 'gst', label: 'GST', route: '/accounting/gst', icon: 'file-percent-outline' },
    { key: 'inventory', label: 'Inventory', route: '/accounting/inventory', icon: 'package-variant-closed' },
];
