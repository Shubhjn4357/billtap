import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ThemePreference } from './theme';

export type SettingsTabKey = 'app' | 'invoicing' | 'inventory' | 'business';
export type SettingsIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const SETTINGS_TABS: { key: SettingsTabKey; label: string; icon: SettingsIconName }[] = [
    { key: 'app', label: 'App', icon: 'tune-variant' },
    { key: 'invoicing', label: 'Invoicing', icon: 'file-document-outline' },
    { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
    { key: 'business', label: 'Business', icon: 'office-building-outline' },
];

export const SETTINGS_SECTION_TAB_MAP: Record<string, SettingsTabKey> = {
    TAXES_AND_GST: 'invoicing',
    TRANSACTION_HEADER: 'invoicing',
    ITEM_TABLE: 'invoicing',
    TAX_DISCOUNT_TOTAL: 'invoicing',
    MORE_TRANSACTION_FEATURES: 'invoicing',
    ITEM_SETTINGS: 'inventory',
    PARTY_SETTINGS: 'inventory',
    GODOWN_AND_STOCK_TRANSFER: 'inventory',
    GENERAL: 'business',
    MULTI_FIRM: 'business',
    BACKUP_SETTINGS: 'business',
    SECURITY: 'business',
};

export const SETTINGS_SECTION_ICONS: Record<string, SettingsIconName> = {
    GENERAL: 'cog-outline',
    SECURITY: 'shield-lock-outline',
    TAXES_AND_GST: 'file-percent-outline',
    BACKUP_SETTINGS: 'cloud-upload-outline',
    PARTY_SETTINGS: 'account-group-outline',
    ITEM_SETTINGS: 'cube-outline',
    MULTI_FIRM: 'office-building-outline',
    TRANSACTION_HEADER: 'card-text-outline',
    ITEM_TABLE: 'table-large',
    TAX_DISCOUNT_TOTAL: 'percent-outline',
    MORE_TRANSACTION_FEATURES: 'dots-horizontal',
    GODOWN_AND_STOCK_TRANSFER: 'warehouse',
};

export const SETTINGS_STATIC_ITEMS: Record<SettingsTabKey, { label: string; subtitle: string; icon: SettingsIconName; route: string }[]> = {
    app: [],
    invoicing: [],
    inventory: [
        { label: 'Item Masters', subtitle: 'Manage item groups and HSN codes', icon: 'format-list-group', route: '/(main)/more/item-masters' },
        { label: 'Godowns', subtitle: 'Warehouse list and stock transfer setup', icon: 'warehouse', route: '/(main)/more/godowns' },
    ],
    business: [
        { label: 'Announcements', subtitle: 'Product notices and system announcements', icon: 'bullhorn-outline', route: '/(main)/more/announcements' },
        { label: 'Sync Diagnostics', subtitle: 'Offline queue health and blocked items', icon: 'cloud-sync-outline', route: '/(main)/more/sync' },
        { label: 'Operations', subtitle: 'Lock periods and process controls', icon: 'cog-transfer-outline', route: '/(main)/more/operations' },
        { label: 'Printing & Templates', subtitle: 'Invoice preview, printer modes and business card', icon: 'printer-outline', route: '/(main)/more/printing' },
        { label: 'Staff and Roles', subtitle: 'Invite staff and manage role access', icon: 'account-multiple-outline', route: '/(main)/more/staff' },
        { label: 'Role Access Control', subtitle: 'Fine-grained module permissions', icon: 'shield-account-outline', route: '/(main)/more/role-access' },
        { label: 'Switch Business', subtitle: 'Change active firm quickly', icon: 'domain-switch', route: '/(auth)/business-select' },
        { label: 'Subscription', subtitle: 'Manage plan and billing', icon: 'crown-outline', route: '/(main)/more/subscription' },
        { label: 'Legal Center', subtitle: 'Terms, privacy, changelog', icon: 'file-document-outline', route: '/legal' },
    ],
};

export const THEME_OPTIONS: { key: ThemePreference; label: string; icon: SettingsIconName }[] = [
    { key: 'system', label: 'System', icon: 'brightness-auto' },
    { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
    { key: 'dark', label: 'Dark', icon: 'weather-night' },
];
