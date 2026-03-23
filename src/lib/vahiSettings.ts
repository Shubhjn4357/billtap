export type VahiSettingsGroupKey = "business" | "invoicing" | "inventory" | "printing";

export const VAHI_SETTINGS_GROUPS: Array<{
    key: VahiSettingsGroupKey;
    label: string;
    description: string;
}> = [
    {
        key: "business",
        label: "Business",
        description: "Profile, backup, security, and multi-firm controls.",
    },
    {
        key: "invoicing",
        label: "Invoicing",
        description: "GST, invoice headers, item rows, and totals behavior.",
    },
    {
        key: "inventory",
        label: "Inventory",
        description: "Items, parties, stock, and godown controls.",
    },
    {
        key: "printing",
        label: "Printing",
        description: "Invoice print layouts, thermal defaults, and branding.",
    },
];

export const VAHI_SETTINGS_SECTION_GROUP_MAP: Record<string, VahiSettingsGroupKey> = {
    GENERAL: "business",
    BACKUP_SETTINGS: "business",
    MULTI_FIRM: "business",
    SECURITY: "business",
    TAXES_AND_GST: "invoicing",
    TRANSACTION_HEADER: "invoicing",
    ITEM_TABLE: "invoicing",
    TAX_DISCOUNT_TOTAL: "invoicing",
    MORE_TRANSACTION_FEATURES: "invoicing",
    ITEM_SETTINGS: "inventory",
    PARTY_SETTINGS: "inventory",
    GODOWN_AND_STOCK_TRANSFER: "inventory",
    INVOICE_PRINT: "printing",
};

export const VAHI_SETTINGS_SECTION_LABELS: Record<string, string> = {
    GENERAL: "General",
    ITEM_SETTINGS: "Item Settings",
    PARTY_SETTINGS: "Party Settings",
    TAXES_AND_GST: "Taxes & GST",
    TRANSACTION_HEADER: "Transaction Header",
    ITEM_TABLE: "Item Table",
    TAX_DISCOUNT_TOTAL: "Tax / Discount / Total",
    MORE_TRANSACTION_FEATURES: "More Transaction Features",
    INVOICE_PRINT: "Invoice Print",
    BACKUP_SETTINGS: "Backup Settings",
    MULTI_FIRM: "Multi Firm",
    GODOWN_AND_STOCK_TRANSFER: "Godown & Stock Transfer",
    SECURITY: "Security",
};

export const getVahiSettingsSectionLabel = (section: string) =>
    VAHI_SETTINGS_SECTION_LABELS[section] ?? section.replaceAll("_", " ");
