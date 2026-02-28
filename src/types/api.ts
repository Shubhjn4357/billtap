// API response wrapper types

export interface ApiResponse<T> {
    ok: boolean;
    data: T;
    message?: string;
}

export interface ApiListResponse<T> {
    ok: boolean;
    data: T[];
    total?: number;
    message?: string;
}

export interface ApiOkResponse {
    ok: boolean;
    message?: string;
}

export interface PaginationParams {
    limit?: number;
    offset?: number;
}

export interface DateRangeParams {
    from?: string;
    to?: string;
}

// Auth endpoint types
export interface GoogleAuthPayload {
    idToken: string;
    platform: 'ANDROID' | 'IOS' | 'WEB';
}

export interface AuthResponse {
    ok: boolean;
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        photoUrl: string | null;
    };
    business: {
        id: string;
        name: string;
    } | null;
    subscription: {
        tier: string;
        status: string;
    } | null;
}

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

export interface SettingsSchemaResponse {
    sections: string[];
    schema: Record<string, SettingsFieldDefinition[]>;
}

// Reporting types
export interface ReportSummary {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    netProfit: number;
    outstandingReceivables: number;
    outstandingPayables: number;
    period: string;
}

export interface SalesTrendPoint {
    date: string;
    amount: number;
    count: number;
}

export interface GSTR1Data {
    period: string;
    invoices: Array<{
        invoiceNumber: string;
        invoiceDate: string;
        gstin: string | null;
        partyName: string;
        totalInvoiceValue: number;
        totalTaxable: number;
        igst: number;
        cgst: number;
        sgst: number;
        invoiceType: string;
    }>;
    summary: {
        totalTaxable: number;
        totalTax: number;
        totalInvoiceValue: number;
    };
}
