import type { InvoicePrintConfig } from '../utils/invoiceHtml';
import {
    getCustomItemCategories,
    getCustomItemUnits,
    getItemCategoryOptions,
    getItemUnitOptions,
} from '../utils/itemMasters';
import {
    parseRoleActionOverrides,
    parseRoleModuleOverrides,
    ROLE_ACTION_OVERRIDES_KEY,
    ROLE_MODULE_OVERRIDES_KEY,
    type RoleActionOverrides,
    type RoleModuleOverrides,
} from '../utils/accessControl';
import { isValidUpiId, sanitizeUpiId } from '../utils/upi';

export type ScannerMode = 'USB_SCANNER' | 'PHONE_CAMERA';
export type ThermalPreset = '58MM_COMPACT' | '80MM_STANDARD' | 'A4_CLASSIC';
export type PrinterConnection = 'USB' | 'BLUETOOTH' | 'WIFI';
export type StandardLayout = 'MODERN' | 'CLASSIC' | 'MINIMAL';
export type SyncConflictPolicy = 'LAST_WRITE_WINS' | 'SERVER_WINS';

const asSettingsRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

export const selectGeneralPaymentSettings = (value: unknown) => {
    const settings = asSettingsRecord(value);
    const upiIdRaw = typeof settings.payment_upi_id === 'string' ? sanitizeUpiId(settings.payment_upi_id) : '';
    const receiverName = typeof settings.payment_receiver_name === 'string' ? settings.payment_receiver_name.trim() : '';
    const signatureUrl = typeof settings.signature_url === 'string'
        ? settings.signature_url.trim()
        : typeof settings.signatureUrl === 'string'
            ? settings.signatureUrl.trim()
            : '';

    return {
        raw: settings,
        upiId: isValidUpiId(upiIdRaw) ? upiIdRaw : '',
        receiverName,
        signatureUrl,
    };
};

export const selectGeneralSyncSettings = (value: unknown) => {
    const settings = asSettingsRecord(value);
    const autoSyncInterval = Number(settings.sync_auto_interval_sec);

    return {
        raw: settings,
        conflictPolicy: settings.sync_conflict_policy === 'SERVER_WINS'
            ? 'SERVER_WINS'
            : 'LAST_WRITE_WINS' as SyncConflictPolicy,
        autoSyncIntervalSec: Number.isFinite(autoSyncInterval)
            ? Math.min(3600, Math.max(15, Math.round(autoSyncInterval)))
            : 60,
    };
};

export const selectInvoicePrintConfig = (value: unknown): InvoicePrintConfig => {
    const settings = asSettingsRecord(value);
    return {
        printLayoutType: settings.print_layout_type === 'THERMAL' ? 'THERMAL' : 'REGULAR',
        printTextSize: settings.print_text_size === 'SMALL' || settings.print_text_size === 'LARGE'
            ? settings.print_text_size
            : 'MEDIUM',
        pageSize: typeof settings.page_size === 'string' && settings.page_size.trim() ? settings.page_size : 'A4',
        orientation: settings.orientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT',
        printCompanyInfo: Boolean(settings.print_company_info ?? true),
        printCompanyName: Boolean(settings.print_company_name ?? true),
        printCompanyLogo: Boolean(settings.print_company_logo ?? false),
        printAddressEmailPhone: Boolean(settings.print_address_email_phone ?? true),
        printGstinOnSale: Boolean(settings.print_gstin_on_sale ?? true),
        printTaxDetailsBreakup: Boolean(settings.print_tax_details_breakup ?? true),
        printDescription: Boolean(settings.print_description ?? true),
        printTermsAndConditions: Boolean(settings.print_terms_and_conditions ?? false),
        printSignatureText: Boolean(settings.print_signature_text ?? false),
        printSignatureImage: Boolean(settings.print_signature_image ?? true),
        customSignatureText: typeof settings.custom_signature_text === 'string' ? settings.custom_signature_text.trim() : '',
        printPaymentMode: Boolean(settings.print_payment_mode ?? false),
        printReceivedAmount: Boolean(settings.print_received_amount ?? false),
        printBalanceAmount: Boolean(settings.print_balance_amount ?? false),
        printTotalItemQuantity: Boolean(settings.print_total_item_quantity ?? false),
        printPageNumbers: Boolean(settings.print_page_numbers ?? true),
        printAmountWithDecimal: Boolean(settings.print_amount_with_decimal ?? true),
    };
};

export const selectPrintingSettings = (value: unknown) => {
    const settings = asSettingsRecord(value);
    const thermalPreset: ThermalPreset = settings.thermal_profile_preset === '58MM_COMPACT'
        ? '58MM_COMPACT'
        : settings.thermal_profile_preset === 'A4_CLASSIC'
            ? 'A4_CLASSIC'
            : '80MM_STANDARD';
    const connection: PrinterConnection = settings.printer_connection_type === 'BLUETOOTH'
        ? 'BLUETOOTH'
        : settings.printer_connection_type === 'WIFI'
            ? 'WIFI'
            : 'USB';
    const standardLayout: StandardLayout = settings.standard_layout === 'CLASSIC'
        ? 'CLASSIC'
        : settings.standard_layout === 'MINIMAL'
            ? 'MINIMAL'
            : 'MODERN';

    return {
        raw: settings,
        invoicePrintConfig: selectInvoicePrintConfig(settings),
        printLayoutType: (settings.print_layout_type === 'REGULAR' ? 'REGULAR' : 'THERMAL') as 'REGULAR' | 'THERMAL',
        thermalPreset,
        connection,
        pairingName: typeof settings.printer_pairing_name === 'string' ? settings.printer_pairing_name : '',
        standardLayout,
        showLogo: settings.show_logo !== false,
        showSignature: settings.show_signature === true,
        footerText: typeof settings.footer_text === 'string' ? settings.footer_text : '',
        termsText: typeof settings.terms_text === 'string' ? settings.terms_text : '',
    };
};

export const selectItemSettings = (value: unknown) => {
    const settings = asSettingsRecord(value);
    const barcodeEnabled = Boolean(settings.barcode_scanning_enabled ?? false);
    const scannerType: ScannerMode = settings.barcode_scanner_type === 'PHONE_CAMERA'
        ? 'PHONE_CAMERA'
        : 'USB_SCANNER';

    return {
        raw: settings,
        defaultUnit: typeof settings.default_unit === 'string' ? settings.default_unit.trim() : '',
        customCategories: getCustomItemCategories(settings),
        customUnits: getCustomItemUnits(settings),
        categoryOptions: getItemCategoryOptions(settings),
        unitOptions: getItemUnitOptions(settings),
        barcodeEnabled,
        scannerType,
        canUseCameraScanner: barcodeEnabled && scannerType === 'PHONE_CAMERA',
        isUsbScannerMode: barcodeEnabled && scannerType === 'USB_SCANNER',
    };
};

export const selectSecuritySettings = (value: unknown): {
    raw: Record<string, unknown>;
    actionOverrides: RoleActionOverrides;
    moduleOverrides: RoleModuleOverrides;
    enablePasscode: boolean;
    enableBiometric: boolean;
} => {
    const settings = asSettingsRecord(value);
    return {
        raw: settings,
        actionOverrides: parseRoleActionOverrides(settings[ROLE_ACTION_OVERRIDES_KEY]),
        moduleOverrides: parseRoleModuleOverrides(settings[ROLE_MODULE_OVERRIDES_KEY]),
        enablePasscode: Boolean(settings.enable_passcode ?? false),
        enableBiometric: Boolean(settings.enable_biometric ?? false),
    };
};
