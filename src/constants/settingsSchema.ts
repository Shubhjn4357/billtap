import { SettingsSection } from './enums';

export const SETTINGS_SECTION_ORDER: string[] = [
    SettingsSection.GENERAL,
    SettingsSection.ITEM_SETTINGS,
    SettingsSection.PARTY_SETTINGS,
    SettingsSection.TAXES_AND_GST,
    SettingsSection.PAYMENT_REMINDERS,
    SettingsSection.TRANSACTION_SMS,
    SettingsSection.TRANSACTION_HEADER,
    SettingsSection.ITEM_TABLE,
    SettingsSection.TAX_DISCOUNT_TOTAL,
    SettingsSection.MORE_TRANSACTION_FEATURES,
    SettingsSection.INVOICE_PRINT,
    SettingsSection.BACKUP_SETTINGS,
    SettingsSection.MULTI_FIRM,
    SettingsSection.GODOWN_AND_STOCK_TRANSFER,
    SettingsSection.SECURITY,
];

export const SETTINGS_SECTION_LABELS: Record<string, string> = {
    [SettingsSection.GENERAL]: 'General',
    [SettingsSection.ITEM_SETTINGS]: 'Item Settings',
    [SettingsSection.PARTY_SETTINGS]: 'Party Settings',
    [SettingsSection.TAXES_AND_GST]: 'Taxes & GST',
    [SettingsSection.PAYMENT_REMINDERS]: 'Payment Reminders',
    [SettingsSection.TRANSACTION_SMS]: 'Transaction SMS',
    [SettingsSection.TRANSACTION_HEADER]: 'Transaction Header',
    [SettingsSection.ITEM_TABLE]: 'Item Table',
    [SettingsSection.TAX_DISCOUNT_TOTAL]: 'Tax / Discount / Total',
    [SettingsSection.MORE_TRANSACTION_FEATURES]: 'More Transaction Features',
    [SettingsSection.INVOICE_PRINT]: 'Invoice Print',
    [SettingsSection.BACKUP_SETTINGS]: 'Backup Settings',
    [SettingsSection.MULTI_FIRM]: 'Multi Firm',
    [SettingsSection.GODOWN_AND_STOCK_TRANSFER]: 'Godown & Stock Transfer',
    [SettingsSection.SECURITY]: 'Security',
};

export const getSettingsSectionLabel = (section: string) =>
    SETTINGS_SECTION_LABELS[section] ?? section.replaceAll('_', ' ');
