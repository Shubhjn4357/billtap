import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeatureFlag } from './enums';
import type { AppAction, AppModule } from '../utils/accessControl';

export type NavigationIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type NavigationShortcut = {
    key: string;
    label: string;
    route: string;
    icon: NavigationIconName;
    module?: AppModule;
    action?: AppAction;
    description?: string;
    ownerOnly?: boolean;
    requiresPos?: boolean;
    requiresFeature?: FeatureFlag;
};

export type CashBankQuickAction = {
    key: string;
    label: string;
    route: string;
    icon: NavigationIconName;
    tone: 'success' | 'error' | 'primary' | 'primaryVariant';
};

export const TAB_BAR_QUICK_ACTIONS: NavigationShortcut[] = [
    { key: 'screen-directory', label: 'Screen Directory', route: '/(main)/more/screen-directory', icon: 'compass-outline' },
    { key: 'sale-invoice', label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline', module: 'billing', action: 'billing.create' },
    { key: 'purchase-bill', label: 'Purchase Bill', route: '/(main)/billing/create?type=PURCHASE_BILL', icon: 'cart-plus', module: 'billing', action: 'billing.create' },
    { key: 'pos-sale', label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale', module: 'billing', requiresPos: true },
    { key: 'payment-in', label: 'Payment In', route: '/(main)/billing/payment-in', icon: 'cash-plus', module: 'accounts' },
    { key: 'payment-out', label: 'Payment Out', route: '/(main)/billing/payment-out', icon: 'cash-minus', module: 'accounts' },
    { key: 'add-item', label: 'Add Item', route: '/(main)/inventory/add-item', icon: 'package-variant-plus', module: 'inventory', action: 'inventory.create' },
    { key: 'add-party', label: 'Add Party', route: '/(main)/parties/add', icon: 'account-plus', module: 'parties', action: 'party.create' },
    { key: 'billing-list', label: 'Billing List', route: '/(main)/billing', icon: 'file-document-multiple-outline', module: 'billing' },
    { key: 'inventory', label: 'Inventory', route: '/(main)/inventory', icon: 'archive-outline', module: 'inventory' },
    { key: 'reports', label: 'Reports', route: '/(main)/reports', icon: 'chart-line', module: 'reports' },
    { key: 'cash-bank', label: 'Cash & Bank', route: '/(main)/accounts/cash-bank', icon: 'bank-outline', module: 'accounts' },
    { key: 'settings', label: 'Settings', route: '/(main)/more/settings', icon: 'cog-outline', module: 'settings' },
];

export const SIDE_DRAWER_ACTIONS: NavigationShortcut[] = [
    { key: 'home', label: 'Dashboard', route: '/(main)', icon: 'view-dashboard-outline', module: 'home' },
    { key: 'billing', label: 'Billing', route: '/(main)/billing', icon: 'file-document-multiple-outline', module: 'billing' },
    { key: 'sale-invoice', label: 'New Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline', module: 'billing' },
    { key: 'pos-sale', label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale', module: 'billing', requiresPos: true },
    { key: 'inventory', label: 'Inventory', route: '/(main)/inventory', icon: 'archive-outline', module: 'inventory' },
    { key: 'add-item', label: 'Add Item', route: '/(main)/inventory/add-item', icon: 'package-variant-plus', module: 'inventory' },
    { key: 'parties', label: 'Parties', route: '/(main)/parties', icon: 'account-multiple-outline', module: 'parties' },
    { key: 'accounts', label: 'Accounts', route: '/(main)/accounts', icon: 'bank-outline', module: 'accounts' },
    { key: 'reports', label: 'Reports', route: '/(main)/reports', icon: 'chart-line', module: 'reports' },
    { key: 'staff', label: 'Staff and Roles', route: '/(main)/more/staff', icon: 'account-group-outline', module: 'staff' },
    { key: 'settings', label: 'Settings', route: '/(main)/more/settings', icon: 'cog-outline', module: 'settings' },
    { key: 'screen-directory', label: 'Screen Directory', route: '/(main)/more/screen-directory', icon: 'compass-outline' },
];

export const GO_TO_PALETTE_ROUTES: NavigationShortcut[] = [
    { key: 'dashboard', label: 'Dashboard', route: '/(main)', description: 'Home summary', module: 'home', icon: 'view-dashboard-outline' },
    { key: 'billing', label: 'Billing', route: '/(main)/billing', description: 'Sales and purchases', module: 'billing', icon: 'file-document-multiple-outline' },
    { key: 'create-invoice', label: 'Create Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', description: 'New tax invoice', module: 'billing', icon: 'file-document-plus-outline' },
    { key: 'pos-sale', label: 'POS Sale', route: '/(main)/billing/pos', description: 'Point of sale billing', module: 'billing', icon: 'point-of-sale', requiresPos: true },
    { key: 'inventory', label: 'Inventory', route: '/(main)/inventory', description: 'Items and stock', module: 'inventory', icon: 'archive-outline' },
    { key: 'add-item', label: 'Add Item', route: '/(main)/inventory/add-item', description: 'Create inventory item', module: 'inventory', icon: 'package-variant-plus' },
    { key: 'parties', label: 'Parties', route: '/(main)/parties', description: 'Customers and suppliers', module: 'parties', icon: 'account-multiple-outline' },
    { key: 'add-party', label: 'Add Party', route: '/(main)/parties/add', description: 'Create customer/supplier', module: 'parties', icon: 'account-plus' },
    { key: 'accounts', label: 'Accounts', route: '/(main)/accounts', description: 'Cash, bank, loans, expenses', module: 'accounts', icon: 'bank-outline' },
    { key: 'cash-bank', label: 'Cash and Bank', route: '/(main)/accounts/cash-bank', description: 'Cash/bank ledger', module: 'accounts', icon: 'bank-outline' },
    { key: 'expenses', label: 'Expenses', route: '/(main)/accounts/expenses', description: 'Expense entries', module: 'accounts', icon: 'cash-minus' },
    { key: 'loans', label: 'Loans', route: '/(main)/accounts/loans', description: 'Loan management', module: 'accounts', icon: 'hand-coin-outline' },
    { key: 'reports', label: 'Reports', route: '/(main)/reports', description: 'Business reports', module: 'reports', icon: 'chart-line' },
    { key: 'trial-balance', label: 'Trial Balance', route: '/(main)/reports/trial-balance', description: 'Debit/credit balancing', module: 'reports', icon: 'scale-balance' },
    { key: 'balance-sheet', label: 'Balance Sheet', route: '/(main)/reports/balance-sheet', description: 'Assets and liabilities snapshot', module: 'reports', icon: 'safe-square-outline' },
    { key: 'ledgers', label: 'Ledgers', route: '/(main)/reports/ledgers', description: 'Account ledgers', module: 'reports', icon: 'book-outline' },
    { key: 'gst-summary', label: 'GST Summary', route: '/(main)/reports/gst-summary', description: 'GST slab report', module: 'reports', icon: 'file-percent-outline' },
    { key: 'more', label: 'More', route: '/(main)/more', description: 'Utilities and controls', icon: 'dots-horizontal-circle-outline' },
    { key: 'settings', label: 'Settings', route: '/(main)/more/settings', description: 'Business settings', module: 'settings', icon: 'cog-outline' },
    { key: 'staff', label: 'Staff', route: '/(main)/more/staff', description: 'Team management', module: 'staff', icon: 'account-group-outline' },
    { key: 'role-access', label: 'Role Access', route: '/(main)/more/role-access', description: 'Role based controls', module: 'settings', icon: 'shield-account-outline', ownerOnly: true },
    { key: 'godowns', label: 'Godowns', route: '/(main)/more/godowns', description: 'Warehouse management', module: 'inventory', icon: 'warehouse', requiresFeature: FeatureFlag.MULTI_GODOWN },
    { key: 'subscription', label: 'Subscription', route: '/(main)/more/subscription', description: 'Plan and limits', icon: 'star-circle-outline' },
    { key: 'screen-directory', label: 'Screen Directory', route: '/(main)/more/screen-directory', description: 'Full route explorer', icon: 'compass-outline' },
    { key: 'legal', label: 'Legal Center', route: '/legal', description: 'Terms/privacy/changelog', icon: 'file-document-outline' },
    { key: 'stock-scanner', label: 'Stock Scanner', route: '/scan?target=stock', description: 'Barcode scanner', module: 'inventory', icon: 'barcode-scan' },
];

export const HOME_QUICK_ACTIONS: NavigationShortcut[] = [
    { key: 'sale-invoice', label: 'Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline', module: 'billing' },
    { key: 'pos-sale', label: 'POS', route: '/(main)/billing/pos', icon: 'point-of-sale', module: 'billing', requiresPos: true },
    { key: 'purchase-bill', label: 'Purchase', route: '/(main)/billing/create?type=PURCHASE_BILL', icon: 'cart-plus', module: 'billing' },
    { key: 'estimate', label: 'Estimate', route: '/(main)/billing/create?type=ESTIMATE', icon: 'file-document-edit-outline', module: 'billing' },
    { key: 'expense', label: 'Expense', route: '/(main)/accounts/expenses/add', icon: 'cash-minus', module: 'accounts' },
    { key: 'add-item', label: 'Add Item', route: '/(main)/inventory/add-item', icon: 'package-variant-plus', module: 'inventory' },
];

export const CASH_BANK_QUICK_ACTIONS: CashBankQuickAction[] = [
    { key: 'deposit', label: 'Deposit', route: '/(main)/accounts/cash-bank/deposit', icon: 'bank-transfer-in', tone: 'success' },
    { key: 'withdraw', label: 'Withdraw', route: '/(main)/accounts/cash-bank/withdraw', icon: 'bank-transfer-out', tone: 'error' },
    { key: 'transfer', label: 'Transfer', route: '/(main)/accounts/cash-bank/transfer', icon: 'swap-horizontal', tone: 'primary' },
    { key: 'add-account', label: 'Add Account', route: '/(main)/accounts/cash-bank/add', icon: 'bank-plus', tone: 'primaryVariant' },
];
