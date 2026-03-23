import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeatureFlag } from './enums';
import type { AppModule } from '../utils/accessControl';

export type UtilityIconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type UtilityTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

export type UtilityScreenLink = {
    label: string;
    route: string;
    description?: string;
    icon?: UtilityIconName;
    tone?: UtilityTone;
    module?: AppModule;
    ownerOnly?: boolean;
    requiresPos?: boolean;
    requiresFeature?: FeatureFlag;
};

export type UtilityScreenSection = {
    title: string;
    items: UtilityScreenLink[];
};

export const MORE_SCREEN_SECTIONS: UtilityScreenSection[] = [
    {
        title: 'Workspace',
        items: [
            { label: 'Settings Hub', route: '/(main)/more/settings', description: 'Business setup, taxes, inventory rules, and app preferences.', icon: 'cog-outline', module: 'settings' },
            { label: 'Subscription', route: '/(main)/more/subscription', description: 'Plan, limits, renewals, and current status.', icon: 'crown-outline', tone: 'info' },
            { label: 'Switch Business', route: '/(auth)/business-select', description: 'Change active firm and local scope.', icon: 'domain-switch', tone: 'info' },
        ],
    },
    {
        title: 'Control Center',
        items: [
            { label: 'Operations', route: '/(main)/more/operations', description: 'Lock periods, approvals, and process controls.', icon: 'cog-transfer-outline', module: 'operations' },
            { label: 'Announcements', route: '/(main)/more/announcements', description: 'Offers and product notices from the system.', icon: 'bullhorn-outline', module: 'operations', tone: 'info' },
            { label: 'Offline Sync Diagnostics', route: '/(main)/more/sync', description: 'Queue health, retry state, and blocked sync items.', icon: 'cloud-sync-outline', tone: 'warning' },
        ],
    },
    {
        title: 'Business',
        items: [
            { label: 'Printing & Templates', route: '/(main)/more/printing', description: 'Thermal, PDF layouts and business card preview.', icon: 'printer-outline', module: 'settings' },
            { label: 'Staff and Roles', route: '/(main)/more/staff', description: 'Invite staff and manage role access.', icon: 'account-group-outline', module: 'staff' },
            { label: 'Role Access', route: '/(main)/more/role-access', description: 'Fine-grained module permissions.', icon: 'shield-account-outline', module: 'settings', ownerOnly: true },
            { label: 'Legal Center', route: '/legal', description: 'Terms, privacy, changelog, and about.', icon: 'file-document-outline', tone: 'default' },
        ],
    },
];

export const SCREEN_DIRECTORY_SECTIONS: UtilityScreenSection[] = [
    {
        title: 'Core Navigation',
        items: [
            { label: 'Dashboard', route: '/(main)', description: 'Main business summary', module: 'home' },
            { label: 'Billing', route: '/(main)/billing', description: 'Invoices and transactions', module: 'billing' },
            { label: 'Inventory', route: '/(main)/inventory', description: 'Items and stock', module: 'inventory' },
            { label: 'Accounts', route: '/(main)/accounts', description: 'Cash, bank, expenses, and loans', module: 'accounts' },
            { label: 'Reports', route: '/(main)/reports', description: 'GST and accounting reports', module: 'reports' },
            { label: 'Parties', route: '/(main)/parties', description: 'Customers and suppliers', module: 'parties' },
            { label: 'More', route: '/(main)/more', description: 'Settings and system modules' },
        ],
    },
    {
        title: 'Billing Flows',
        items: [
            { label: 'Create Sales Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', description: 'Tax invoice billing', module: 'billing' },
            { label: 'POS Sale', route: '/(main)/billing/pos', description: 'Fast POS billing', module: 'billing', requiresPos: true },
            { label: 'Purchase Bill', route: '/(main)/billing/purchase-bill', description: 'Supplier purchase entry', module: 'billing' },
            { label: 'Estimate / Quotation', route: '/(main)/billing/estimate', description: 'Non-posting estimate', module: 'billing' },
            { label: 'Sale Order', route: '/(main)/billing/sale-order', description: 'Sales order workflow', module: 'billing' },
            { label: 'Purchase Order', route: '/(main)/billing/purchase-order', description: 'Purchase order workflow', module: 'billing' },
            { label: 'Sale Return', route: '/(main)/billing/sale-return', description: 'Credit note / return', module: 'billing' },
            { label: 'Purchase Return', route: '/(main)/billing/purchase-return', description: 'Debit note / return', module: 'billing' },
            { label: 'Delivery Challan', route: '/(main)/billing/delivery-challan', description: 'Goods movement document', module: 'billing' },
            { label: 'Payment In', route: '/(main)/billing/payment-in', description: 'Incoming payment entry', module: 'accounts' },
            { label: 'Payment Out', route: '/(main)/billing/payment-out', description: 'Outgoing payment entry', module: 'accounts' },
        ],
    },
    {
        title: 'Inventory and Masters',
        items: [
            { label: 'Add Item', route: '/(main)/inventory/add-item', description: 'Create product/service', module: 'inventory' },
            { label: 'Item Recycle Bin', route: '/(main)/inventory/recycle-bin', description: 'Restore archived items', module: 'inventory' },
            { label: 'Item Masters', route: '/(main)/more/item-masters', description: 'Categories and units', module: 'inventory' },
            { label: 'Godowns', route: '/(main)/more/godowns', description: 'Warehouse and stock transfer', module: 'inventory', requiresFeature: FeatureFlag.MULTI_GODOWN },
            { label: 'Stock Scan', route: '/scan?target=stock', description: 'Barcode scanner route', module: 'inventory' },
        ],
    },
    {
        title: 'Accounts Operations',
        items: [
            { label: 'Cash and Bank', route: '/(main)/accounts/cash-bank', description: 'All cash/bank balances', module: 'accounts' },
            { label: 'Add Cash/Bank Account', route: '/(main)/accounts/cash-bank/add', description: 'Create account ledger', module: 'accounts' },
            { label: 'Deposit', route: '/(main)/accounts/cash-bank/deposit', description: 'Bank deposit entry', module: 'accounts' },
            { label: 'Withdraw', route: '/(main)/accounts/cash-bank/withdraw', description: 'Bank withdrawal entry', module: 'accounts' },
            { label: 'Transfer', route: '/(main)/accounts/cash-bank/transfer', description: 'Contra transfer', module: 'accounts' },
            { label: 'Expenses', route: '/(main)/accounts/expenses', description: 'Expense register', module: 'accounts' },
            { label: 'Add Expense', route: '/(main)/accounts/expenses/add', description: 'Record expense entry', module: 'accounts' },
            { label: 'Expense Recycle Bin', route: '/(main)/accounts/expenses/recycle-bin', description: 'Restore archived expenses', module: 'accounts' },
            { label: 'Loans', route: '/(main)/accounts/loans', description: 'Loan register', module: 'accounts' },
            { label: 'Add Loan', route: '/(main)/accounts/loans/add', description: 'Create loan account', module: 'accounts' },
        ],
    },
    {
        title: 'Reports',
        items: [
            { label: 'GST Summary', route: '/(main)/reports/gst-summary', description: 'Slab-wise GST report', module: 'reports' },
            { label: 'Trial Balance', route: '/(main)/reports/trial-balance', description: 'Dr/Cr integrity check', module: 'reports' },
            { label: 'Balance Sheet', route: '/(main)/reports/balance-sheet', description: 'Assets vs liability position', module: 'reports' },
            { label: 'Ledgers', route: '/(main)/reports/ledgers', description: 'Ledger list and drilldown', module: 'reports' },
            { label: 'Profit and Loss', route: '/(main)/more/reports/pnl', description: 'Income vs expense report', module: 'reports' },
            { label: 'GSTR-1', route: '/(main)/more/reports/gstr1', description: 'Outward supplies', module: 'reports' },
            { label: 'GSTR-3B', route: '/(main)/more/reports/gstr3b', description: 'Monthly GST summary', module: 'reports' },
        ],
    },
    {
        title: 'Control and Settings',
        items: [
            { label: 'Settings', route: '/(main)/more/settings', description: 'All settings sections', module: 'settings' },
            { label: 'Staff', route: '/(main)/more/staff', description: 'Invite/manage team', module: 'staff' },
            { label: 'Role Access', route: '/(main)/more/role-access', description: 'Role/module/action permissions', module: 'settings', ownerOnly: true },
            { label: 'Operations', route: '/(main)/more/operations', description: 'Utility tools', module: 'operations' },
            { label: 'Announcements', route: '/(main)/more/announcements', description: 'Business notifications', module: 'operations' },
            { label: 'Sync Diagnostics', route: '/(main)/more/sync', description: 'Offline sync queue and status' },
            { label: 'Printing & Templates', route: '/(main)/more/printing', description: 'Thermal and PDF print profiles', module: 'settings' },
            { label: 'App Preferences', route: '/(main)/more/settings', description: 'Theme, haptics, and device preferences', module: 'settings' },
            { label: 'Subscription', route: '/(main)/more/subscription', description: 'Plan and limits' },
        ],
    },
    {
        title: 'Legal',
        items: [
            { label: 'Legal Center', route: '/legal', description: 'All legal documents' },
            { label: 'Terms of Service', route: '/legal/terms', description: 'Terms and conditions' },
            { label: 'Privacy Policy', route: '/legal/privacy', description: 'Data privacy statement' },
            { label: 'Changelog', route: '/legal/changelog', description: 'Version history' },
            { label: 'About', route: '/legal/about', description: 'App information' },
        ],
    },
];
