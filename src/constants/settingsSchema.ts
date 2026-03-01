export const SETTINGS_SECTIONS = [
    'GENERAL',
    'ITEM_SETTINGS',
    'PARTY_SETTINGS',
    'TAXES_AND_GST',
    'PAYMENT_REMINDERS',
    'TRANSACTION_SMS',
    'TRANSACTION_HEADER',
    'ITEM_TABLE',
    'TAX_DISCOUNT_TOTAL',
    'MORE_TRANSACTION_FEATURES',
    'INVOICE_PRINT',
    'BACKUP_SETTINGS',
    'MULTI_FIRM',
    'GODOWN_AND_STOCK_TRANSFER',
    'SECURITY',
] as const;

export type SettingsSection = typeof SETTINGS_SECTIONS[number];

export const VOUCHER_TYPES = [
    'SALES_INVOICE',
    'POS_SALE',
    'PURCHASE_BILL',
    'PAYMENT_IN',
    'PAYMENT_OUT',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'ESTIMATE',
    'PROFORMA_INVOICE',
    'SALE_ORDER',
    'PURCHASE_ORDER',
    'DELIVERY_CHALLAN',
    'GOODS_RETURN_DC',
    'OTHER_INCOME_VOUCHER',
    'FIXED_ASSET_VOUCHER',
    'CONTRA',
    'JOURNAL',
] as const;

export type SettingsFieldType = 'boolean' | 'string' | 'integer' | 'number' | 'enum' | 'array_of_VoucherType';

export interface SettingsFieldDefinition {
    key: string;
    label: string;
    type: SettingsFieldType;
    default?: boolean | number | string | string[] | null;
    min?: number;
    max?: number;
    allowed?: string[];
    enumValues?: string[];
    nullable?: boolean;
}

export const SETTINGS_SCHEMA: Record<SettingsSection, SettingsFieldDefinition[]> = {
    GENERAL: [
        { key: 'app_language', label: 'App Language', type: 'enum', enumValues: ['ENGLISH'] },
        { key: 'business_currency', label: 'Business Currency', type: 'string', default: 'INR' },
        { key: 'decimal_places', label: 'Decimal Places', type: 'integer', default: 2, min: 0, max: 4 },
        { key: 'date_format', label: 'Date Format', type: 'enum', enumValues: ['DD_MM_YYYY', 'DD_MMM_YYYY'], default: 'DD_MM_YYYY' },
        { key: 'warn_unsaved_changes', label: 'Warn Unsaved Changes', type: 'boolean', default: true },
        { key: 'theme_mode', label: 'Theme Mode', type: 'enum', enumValues: ['LIGHT', 'DARK', 'SYSTEM'], default: 'SYSTEM' },
        { key: 'payment_upi_id', label: 'Payment UPI ID', type: 'string', nullable: true },
        { key: 'payment_receiver_name', label: 'UPI Receiver Name', type: 'string', nullable: true },
    ],
    SECURITY: [
        { key: 'enable_passcode', label: 'Enable Passcode', type: 'boolean', default: false },
        { key: 'enable_biometric', label: 'Enable Biometric', type: 'boolean', default: false },
    ],
    MULTI_FIRM: [
        { key: 'multi_firm_enabled', label: 'Enable Multi Firm', type: 'boolean', default: false },
        { key: 'allow_firm_switching_without_restart', label: 'Switch Firm Without Restart', type: 'boolean', default: true },
    ],
    GODOWN_AND_STOCK_TRANSFER: [
        { key: 'godown_management_enabled', label: 'Godown Management', type: 'boolean', default: false },
        { key: 'stock_transfer_enabled', label: 'Stock Transfer', type: 'boolean', default: false },
    ],
    BACKUP_SETTINGS: [
        { key: 'auto_backup_enabled', label: 'Auto Backup', type: 'boolean', default: false },
        { key: 'backup_frequency_days', label: 'Backup Frequency (days)', type: 'integer', default: 1, min: 1, max: 30 },
        { key: 'backup_destination', label: 'Backup Destination', type: 'enum', enumValues: ['LOCAL', 'CLOUD'], default: 'LOCAL' },
    ],
    ITEM_SETTINGS: [
        { key: 'enable_item_module', label: 'Enable Item Module', type: 'boolean', default: true },
        { key: 'item_type_default', label: 'Item Type Default', type: 'enum', enumValues: ['PRODUCTS_AND_SERVICES'], default: 'PRODUCTS_AND_SERVICES' },
        { key: 'barcode_scanning_enabled', label: 'Barcode Scanning', type: 'boolean', default: false },
        { key: 'barcode_scanner_type', label: 'Barcode Scanner Type', type: 'enum', enumValues: ['USB_SCANNER', 'PHONE_CAMERA'], default: 'USB_SCANNER' },
        { key: 'stock_maintenance_enabled', label: 'Stock Maintenance', type: 'boolean', default: true },
        { key: 'manufacturing_enabled', label: 'Manufacturing', type: 'boolean', default: false },
        { key: 'item_units_enabled', label: 'Item Units', type: 'boolean', default: true },
        { key: 'default_unit', label: 'Default Unit', type: 'string', nullable: true },
        { key: 'item_category_enabled', label: 'Item Category', type: 'boolean', default: true },
        { key: 'party_wise_item_rate_enabled', label: 'Party-wise Item Rate', type: 'boolean', default: false },
        { key: 'wholesale_price_enabled', label: 'Wholesale Price', type: 'boolean', default: false },
        { key: 'quantity_decimal_places', label: 'Quantity Decimal Places', type: 'integer', default: 2, min: 0, max: 3 },
        { key: 'item_wise_tax_enabled', label: 'Item-wise Tax', type: 'boolean', default: true },
        { key: 'item_wise_discount_enabled', label: 'Item-wise Discount', type: 'boolean', default: true },
        { key: 'update_sale_price_from_transaction', label: 'Update Sale Price from Transaction', type: 'boolean', default: false },
        { key: 'additional_item_fields_enabled', label: 'Additional Item Fields', type: 'boolean', default: false },
        { key: 'item_custom_fields_enabled', label: 'Item Custom Fields', type: 'boolean', default: false },
        { key: 'item_description_enabled', label: 'Item Description', type: 'boolean', default: true },
    ],
    PARTY_SETTINGS: [
        { key: 'show_gstin_field', label: 'Show GSTIN Field', type: 'boolean', default: true },
        { key: 'party_grouping_enabled', label: 'Party Grouping', type: 'boolean', default: false },
        { key: 'party_additional_fields_enabled', label: 'Additional Party Fields', type: 'boolean', default: false },
        { key: 'party_shipping_address_enabled', label: 'Party Shipping Address', type: 'boolean', default: true },
        { key: 'invite_parties_to_add_themselves', label: 'Invite Parties to Add Themselves', type: 'boolean', default: false },
        { key: 'loyalty_points_enabled', label: 'Loyalty Points', type: 'boolean', default: false },
    ],
    TAXES_AND_GST: [
        { key: 'gst_enabled', label: 'Enable GST', type: 'boolean', default: true },
        { key: 'hsn_sac_enabled', label: 'Enable HSN/SAC', type: 'boolean', default: true },
        { key: 'additional_cess_enabled', label: 'Enable Additional CESS', type: 'boolean', default: false },
        { key: 'reverse_charge_enabled', label: 'Enable Reverse Charge', type: 'boolean', default: false },
        { key: 'state_of_supply_enabled', label: 'Enable State of Supply', type: 'boolean', default: true },
        { key: 'eway_bill_no_enabled', label: 'Enable E-Way Bill Number', type: 'boolean', default: false },
        { key: 'composite_scheme_enabled', label: 'Composite Scheme', type: 'boolean', default: false },
        { key: 'composite_user_type', label: 'Composite User Type', type: 'string', nullable: true },
        { key: 'tcs_enabled', label: 'Enable TCS', type: 'boolean', default: false },
        { key: 'tds_enabled', label: 'Enable TDS', type: 'boolean', default: false },
    ],
    PAYMENT_REMINDERS: [
        { key: 'self_payment_reminder_enabled', label: 'Self Reminder', type: 'boolean', default: false },
        { key: 'self_reminder_days_overdue', label: 'Self Reminder Days Overdue', type: 'integer', default: 1, min: 1, max: 30 },
        { key: 'self_reminder_frequency', label: 'Self Reminder Frequency', type: 'enum', enumValues: ['ONCE_A_DAY', 'ONCE_A_WEEK'], default: 'ONCE_A_DAY' },
        { key: 'party_payment_reminder_message_template', label: 'Party Reminder Message Template', type: 'string' },
    ],
    TRANSACTION_SMS: [
        { key: 'send_sms_to_party', label: 'Send SMS to Party', type: 'boolean', default: false },
        { key: 'send_sms_copy_to_self', label: 'Send SMS Copy to Self', type: 'boolean', default: false },
        { key: 'send_transaction_update_sms', label: 'Send Transaction Update SMS', type: 'boolean', default: false },
        { key: 'show_party_current_balance_in_sms', label: 'Show Party Current Balance in SMS', type: 'boolean', default: false },
        { key: 'show_web_invoice_link', label: 'Show Web Invoice Link', type: 'boolean', default: true },
        { key: 'auto_share_on_network', label: 'Auto Share on Network', type: 'boolean', default: false },
        {
            key: 'auto_sms_transactions',
            label: 'Auto SMS Transaction Types',
            type: 'array_of_VoucherType',
            default: ['SALES_INVOICE', 'PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PAYMENT_IN', 'PAYMENT_OUT', 'SALE_ORDER'],
            enumValues: [...VOUCHER_TYPES],
        },
    ],
    TRANSACTION_HEADER: [
        { key: 'invoice_number_customizable', label: 'Invoice Number Customizable', type: 'boolean', default: true },
        { key: 'cash_sale_by_default', label: 'Cash Sale by Default', type: 'boolean', default: false },
        { key: 'billing_name_of_parties_enabled', label: 'Billing Name of Parties', type: 'boolean', default: true },
        { key: 'po_details_enabled', label: 'PO Details', type: 'boolean', default: false },
        { key: 'add_time_on_transactions', label: 'Add Time on Transactions', type: 'boolean', default: false },
        { key: 'print_time_on_invoices', label: 'Print Time on Invoices', type: 'boolean', default: false },
    ],
    ITEM_TABLE: [
        { key: 'inclusive_exclusive_tax_switch_enabled', label: 'Inclusive/Exclusive Tax Switch', type: 'boolean', default: true },
        { key: 'display_purchase_price', label: 'Display Purchase Price', type: 'boolean', default: false },
        { key: 'free_item_quantity_enabled', label: 'Free Item Quantity', type: 'boolean', default: false },
        { key: 'barcode_scanning_in_transactions_enabled', label: 'Barcode Scanning in Transactions', type: 'boolean', default: false },
        { key: 'item_table_min_rows_print', label: 'Minimum Item Rows in Print', type: 'integer', default: 0, min: 0, max: 25 },
    ],
    TAX_DISCOUNT_TOTAL: [
        { key: 'transaction_wise_tax_enabled', label: 'Transaction-wise Tax', type: 'boolean', default: true },
        { key: 'transaction_wise_discount_enabled', label: 'Transaction-wise Discount', type: 'boolean', default: true },
        { key: 'round_off_transaction_amount_enabled', label: 'Round Off Transaction Amount', type: 'boolean', default: false },
        { key: 'round_off_mode', label: 'Round Off Mode', type: 'enum', enumValues: ['NEAREST', 'UP', 'DOWN'], default: 'NEAREST' },
        { key: 'round_off_to_value', label: 'Round Off To Value', type: 'number', default: 1, min: 0, max: 100 },
    ],
    MORE_TRANSACTION_FEATURES: [
        { key: 'share_transaction_mode', label: 'Share Transaction Mode', type: 'enum', enumValues: ['ASK_EVERY_TIME', 'PDF', 'IMAGE', 'WHATSAPP', 'EMAIL'], default: 'ASK_EVERY_TIME' },
        { key: 'passcode_for_edit_delete', label: 'Passcode for Edit/Delete', type: 'boolean', default: false },
        { key: 'discount_during_payment_enabled', label: 'Discount During Payment', type: 'boolean', default: false },
        { key: 'link_payments_to_invoices_enabled', label: 'Link Payments to Invoices', type: 'boolean', default: true },
        { key: 'due_dates_and_payment_terms_enabled', label: 'Due Dates and Payment Terms', type: 'boolean', default: true },
        { key: 'invoice_preview_enabled', label: 'Invoice Preview', type: 'boolean', default: true },
        { key: 'transportation_details_enabled', label: 'Transportation Details', type: 'boolean', default: false },
        { key: 'additional_charges_enabled', label: 'Additional Charges', type: 'boolean', default: false },
        { key: 'show_profit_while_billing', label: 'Show Profit While Billing', type: 'boolean', default: false },
    ],
    INVOICE_PRINT: [
        { key: 'print_layout_type', label: 'Print Layout Type', type: 'enum', enumValues: ['REGULAR', 'THERMAL'], default: 'REGULAR' },
        { key: 'make_regular_printer_default', label: 'Regular Printer Default', type: 'boolean', default: true },
        { key: 'theme', label: 'Theme', type: 'string' },
        { key: 'print_text_size', label: 'Print Text Size', type: 'enum', enumValues: ['SMALL', 'MEDIUM', 'LARGE'], default: 'MEDIUM' },
        { key: 'page_size', label: 'Page Size', type: 'string', default: 'A4 (210 x 297 mm)' },
        { key: 'orientation', label: 'Orientation', type: 'enum', enumValues: ['PORTRAIT', 'LANDSCAPE'], default: 'PORTRAIT' },
        { key: 'print_company_info', label: 'Print Company Info', type: 'boolean', default: true },
        { key: 'print_repeat_header_all_pages', label: 'Repeat Header On All Pages', type: 'boolean', default: false },
        { key: 'print_company_name', label: 'Print Company Name', type: 'boolean', default: true },
        { key: 'print_company_logo', label: 'Print Company Logo', type: 'boolean', default: false },
        { key: 'print_address_email_phone', label: 'Print Address Email Phone', type: 'boolean', default: true },
        { key: 'print_gstin_on_sale', label: 'Print GSTIN on Sale', type: 'boolean', default: true },
        { key: 'print_bill_of_supply_for_non_tax', label: 'Bill of Supply for Non-Tax', type: 'boolean', default: false },
        { key: 'extra_spaces_on_top_pdf', label: 'Extra Spaces On Top PDF', type: 'integer', default: 0, min: 0, max: 20 },
        { key: 'print_original_duplicate_label', label: 'Print Original/Duplicate Label', type: 'boolean', default: false },
        { key: 'allow_change_transaction_names', label: 'Allow Change Transaction Names', type: 'boolean', default: false },
        { key: 'print_total_item_quantity', label: 'Print Total Item Quantity', type: 'boolean', default: false },
        { key: 'print_amount_with_decimal', label: 'Print Amount With Decimal', type: 'boolean', default: true },
        { key: 'print_received_amount', label: 'Print Received Amount', type: 'boolean', default: false },
        { key: 'print_balance_amount', label: 'Print Balance Amount', type: 'boolean', default: false },
        { key: 'print_current_balance_of_party', label: 'Print Party Current Balance', type: 'boolean', default: false },
        { key: 'print_tax_details_breakup', label: 'Print Tax Details Breakup', type: 'boolean', default: true },
        { key: 'amount_grouping_enabled', label: 'Amount Grouping', type: 'boolean', default: false },
        { key: 'amount_in_words_format', label: 'Amount In Words Format', type: 'string' },
        { key: 'print_description', label: 'Print Description', type: 'boolean', default: true },
        { key: 'print_terms_and_conditions', label: 'Print Terms and Conditions', type: 'boolean', default: false },
        { key: 'print_received_by_details', label: 'Print Received By Details', type: 'boolean', default: false },
        { key: 'print_delivered_by_details', label: 'Print Delivered By Details', type: 'boolean', default: false },
        { key: 'print_signature_text', label: 'Print Signature Text', type: 'boolean', default: false },
        { key: 'custom_signature_text', label: 'Custom Signature Text', type: 'string' },
        { key: 'print_payment_mode', label: 'Print Payment Mode', type: 'boolean', default: false },
        { key: 'print_acknowledgement', label: 'Print Acknowledgement', type: 'boolean', default: false },
        { key: 'print_page_numbers', label: 'Print Page Numbers', type: 'boolean', default: true },
    ],
};

const SECTION_SET = new Set(SETTINGS_SECTIONS);

export const isValidSettingsSection = (section: string): section is SettingsSection => SECTION_SET.has(section as SettingsSection);

const parseBoolean = (value: unknown, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return fallback;
};

const parseNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
};

const parseInteger = (value: unknown, fallback = 0) => Math.trunc(parseNumber(value, fallback));

export const normalizeSettingsData = (
    section: SettingsSection,
    raw: Record<string, unknown>
) => {
    const fields = SETTINGS_SCHEMA[section] ?? [];
    const normalized: Record<string, unknown> = {};

    for (const field of fields) {
        const hasValue = Object.prototype.hasOwnProperty.call(raw, field.key);
        const value = hasValue ? raw[field.key] : field.default;

        if ((value === null || value === undefined) && field.nullable) {
            normalized[field.key] = null;
            continue;
        }

        switch (field.type) {
            case 'boolean':
                normalized[field.key] = parseBoolean(value, Boolean(field.default ?? false));
                break;
            case 'integer': {
                let parsed = parseInteger(value, Number(field.default ?? 0));
                if (field.min !== undefined) parsed = Math.max(field.min, parsed);
                if (field.max !== undefined) parsed = Math.min(field.max, parsed);
                normalized[field.key] = parsed;
                break;
            }
            case 'number': {
                let parsed = parseNumber(value, Number(field.default ?? 0));
                if (field.min !== undefined) parsed = Math.max(field.min, parsed);
                if (field.max !== undefined) parsed = Math.min(field.max, parsed);
                normalized[field.key] = parsed;
                break;
            }
            case 'enum': {
                const fallback = typeof field.default === 'string' ? field.default : field.enumValues?.[0] ?? '';
                const parsed = typeof value === 'string' ? value : fallback;
                normalized[field.key] = field.enumValues?.includes(parsed) ? parsed : fallback;
                break;
            }
            case 'array_of_VoucherType': {
                const fallback = Array.isArray(field.default) ? field.default : [];
                const source = Array.isArray(value) ? value : fallback;
                normalized[field.key] = source
                    .map((entry) => String(entry))
                    .filter((entry) => VOUCHER_TYPES.includes(entry as typeof VOUCHER_TYPES[number]));
                break;
            }
            case 'string':
            default:
                normalized[field.key] = value == null ? (field.default ?? '') : String(value);
                break;
        }
    }

    return normalized;
};
