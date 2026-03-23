export type VahiAppRouteOption = {
    value: string;
    label: string;
    description: string;
    group: string;
};

export const VAHI_APP_ROUTE_OPTIONS: VahiAppRouteOption[] = [
    { value: '/(main)', label: 'Dashboard', description: 'Main business overview', group: 'Core' },
    { value: '/(main)/billing', label: 'Billing', description: 'Invoice list and billing hub', group: 'Billing' },
    { value: '/(main)/billing/create?type=TAX_INVOICE', label: 'Create Sale Invoice', description: 'New tax invoice draft', group: 'Billing' },
    { value: '/(main)/billing/pos', label: 'Quick Sale (POS)', description: 'Point of sale billing screen', group: 'Billing' },
    { value: '/(main)/billing/payment-in', label: 'Payment In', description: 'Record incoming payment', group: 'Billing' },
    { value: '/(main)/billing/payment-out', label: 'Payment Out', description: 'Record payout or expense payment', group: 'Billing' },
    { value: '/(main)/inventory', label: 'Inventory', description: 'Items and stock overview', group: 'Inventory' },
    { value: '/(main)/inventory/add-item', label: 'Add Item', description: 'Create a new stock item', group: 'Inventory' },
    { value: '/(main)/more/godowns', label: 'Godowns', description: 'Warehouse and stock transfer area', group: 'Inventory' },
    { value: '/(main)/parties', label: 'Parties', description: 'Customers and suppliers', group: 'Parties' },
    { value: '/(main)/parties/add', label: 'Add Party', description: 'Create a customer or supplier', group: 'Parties' },
    { value: '/(main)/accounts', label: 'Accounts', description: 'Accounting dashboard', group: 'Accounts' },
    { value: '/(main)/accounts/cash-bank', label: 'Cash & Bank', description: 'Cash and bank ledgers', group: 'Accounts' },
    { value: '/(main)/accounts/expenses', label: 'Expenses', description: 'Expense tracking module', group: 'Accounts' },
    { value: '/(main)/accounts/loans', label: 'Loans', description: 'Borrowed and given loans', group: 'Accounts' },
    { value: '/(main)/reports', label: 'Reports', description: 'Reporting home', group: 'Reports' },
    { value: '/(main)/reports/trial-balance', label: 'Trial Balance', description: 'Debit and credit balancing', group: 'Reports' },
    { value: '/(main)/reports/balance-sheet', label: 'Balance Sheet', description: 'Assets and liabilities snapshot', group: 'Reports' },
    { value: '/(main)/reports/gst-summary', label: 'GST Summary', description: 'GST reporting summary', group: 'Reports' },
    { value: '/(main)/more', label: 'More', description: 'Utilities and admin-facing tools', group: 'Settings & Utilities' },
    { value: '/(main)/more/settings', label: 'Settings', description: 'App, invoicing, inventory, and business settings', group: 'Settings & Utilities' },
    { value: '/(main)/more/subscription', label: 'Subscription', description: 'Plans, offers, and billing status', group: 'Settings & Utilities' },
    { value: '/(main)/more/announcements', label: 'Announcements', description: 'Offers and platform notices', group: 'Settings & Utilities' },
    { value: '/(main)/more/sync', label: 'Sync Diagnostics', description: 'Offline queue and cloud sync health', group: 'Settings & Utilities' },
    { value: '/(main)/more/printing', label: 'Printing & Templates', description: 'Invoice themes, branding, and business card', group: 'Settings & Utilities' },
    { value: '/(main)/more/operations', label: 'Operations', description: 'Operational controls and approvals', group: 'Settings & Utilities' },
    { value: '/(main)/more/staff', label: 'Staff', description: 'Team and user access management', group: 'Settings & Utilities' },
    { value: '/(main)/more/role-access', label: 'Role Access', description: 'Role based module control', group: 'Settings & Utilities' },
    { value: '/legal', label: 'Legal Center', description: 'Terms, privacy, about, and changelog', group: 'Support' },
];

export const VAHI_APP_ROUTE_GROUPS = Array.from(
    VAHI_APP_ROUTE_OPTIONS.reduce((map, option) => {
        const bucket = map.get(option.group) ?? [];
        bucket.push(option);
        map.set(option.group, bucket);
        return map;
    }, new Map<string, VahiAppRouteOption[]>())
);

export const isPresetVahiAppRoute = (value: string | null | undefined) =>
    Boolean(value && VAHI_APP_ROUTE_OPTIONS.some((option) => option.value === value));

export const getVahiAppRouteLabel = (value: string | null | undefined) =>
    VAHI_APP_ROUTE_OPTIONS.find((option) => option.value === value)?.label ?? null;
