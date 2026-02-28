// All API endpoint functions
import { api } from './client';
import type {
    ApiResponse,
    ApiListResponse,
    ApiOkResponse,
    GoogleAuthPayload,
    AuthResponse,
    PaginationParams,
    DateRangeParams,
    SettingsFieldDefinition,
} from '../types/api';
import type { User, Business, Subscription, Party, Item, Invoice, InvoiceBuilderState, Expense, Loan, LoanTransaction, Godown, GodownStockEntry, StockTransfer, Account, BusinessSettingsMap, Plan, Offer } from '../types/domain';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
    googleSignIn: (payload: GoogleAuthPayload) =>
        api.post<AuthResponse>('/api/auth/google', payload),
    me: () =>
        api.get<ApiResponse<User>>('/api/users/me'),
    updateProfile: (data: Partial<Pick<User, 'name' | 'phone'>>) =>
        api.patch<ApiResponse<User>>('/api/users/me', data),
};

// ─── Businesses ───────────────────────────────────────────────────────────────

export const businessApi = {
    list: () =>
        api.get<ApiListResponse<Business>>('/api/organizations'),
    get: (id: string) =>
        api.get<ApiResponse<Business>>(`/api/organizations/${id}`),
    create: (data: Partial<Business>) =>
        api.post<ApiResponse<Business>>('/api/organizations', data),
    update: (id: string, data: Partial<Business>) =>
        api.put<ApiResponse<Business>>(`/api/organizations/${id}`, data),
    getSubscription: () =>
        api.get<ApiResponse<Subscription>>('/api/subscription'),
    getPlans: () =>
        api.get<ApiListResponse<Plan>>('/api/subscription/plans'),
};

// ─── Parties ─────────────────────────────────────────────────────────────────

export const partyApi = {
    list: (params?: { q?: string; type?: string } & PaginationParams) =>
        api.get<ApiListResponse<Party>>('/api/parties', { params }),
    get: (id: string) =>
        api.get<ApiResponse<Party>>(`/api/parties/${id}`),
    create: (data: Omit<Party, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'loyaltyPoints'>) =>
        api.post<ApiResponse<Party>>('/api/parties', data),
    update: (id: string, data: Partial<Party>) =>
        api.put<ApiResponse<Party>>(`/api/parties/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/parties/${id}`),
    getLedger: (id: string, params?: PaginationParams) =>
        api.get<ApiResponse<{ entries: unknown[]; balance: number }>>(`/api/parties/${id}/ledger`, { params }),
};

// ─── Items ────────────────────────────────────────────────────────────────────

export const itemApi = {
    list: async (params?: { q?: string; limit?: number }) => {
        const res = await api.get<{ ok: boolean; items: Array<Record<string, unknown>> }>('/api/items', { params });
        return {
            ok: res.ok,
            items: (res.items ?? []).map((raw) => ({
                id: String(raw.id),
                businessId: String(raw.businessId ?? ''),
                name: String(raw.name ?? ''),
                sku: raw.sku ? String(raw.sku) : null,
                barcode: raw.barcode ? String(raw.barcode) : null,
                hsnCode: raw.hsn ? String(raw.hsn) : raw.hsnCode ? String(raw.hsnCode) : null,
                unit: raw.unit ? String(raw.unit) : null,
                category: raw.category ? String(raw.category) : null,
                mrp: Number(raw.mrp ?? 0),
                purchasePrice: Number(raw.purchasePrice ?? 0),
                salePrice: Number(raw.price ?? raw.salePrice ?? 0),
                gstRate: Number(raw.gstPercentage ?? raw.gstRate ?? 0),
                openingStock: Number(raw.openingStock ?? raw.stock ?? 0),
                stock: Number(raw.stock ?? 0),
                reorderLevel: Number(raw.minimumStock ?? raw.reorderLevel ?? 0),
                description: raw.description ? String(raw.description) : null,
                location: raw.location ? String(raw.location) : null,
                imageUrl: raw.imageUrl ? String(raw.imageUrl) : null,
                expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
                autoDeleteAt: raw.autoDeleteAt ? String(raw.autoDeleteAt) : null,
                autoDeleteEnabled: Boolean(raw.autoDeleteEnabled ?? false),
                isSalesPriceInclusiveGst: Boolean(raw.isSalesPriceInclusiveGst ?? false),
                trackStock: true,
                isActive: Boolean(raw.isActive ?? true),
                createdAt: String(raw.createdAt ?? new Date().toISOString()),
                updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
            })),
        };
    },
    get: async (id: string) => {
        const res = await api.get<{ ok: boolean; item: Record<string, unknown> }>(`/api/items/${id}`);
        const raw = res.item ?? {};
        return {
            ok: res.ok,
            item: {
                id: String(raw.id ?? id),
                businessId: String(raw.businessId ?? ''),
                name: String(raw.name ?? ''),
                sku: raw.sku ? String(raw.sku) : null,
                barcode: raw.barcode ? String(raw.barcode) : null,
                hsnCode: raw.hsn ? String(raw.hsn) : raw.hsnCode ? String(raw.hsnCode) : null,
                unit: raw.unit ? String(raw.unit) : null,
                category: raw.category ? String(raw.category) : null,
                mrp: Number(raw.mrp ?? 0),
                purchasePrice: Number(raw.purchasePrice ?? 0),
                salePrice: Number(raw.price ?? raw.salePrice ?? 0),
                gstRate: Number(raw.gstPercentage ?? raw.gstRate ?? 0),
                openingStock: Number(raw.openingStock ?? raw.stock ?? 0),
                stock: Number(raw.stock ?? 0),
                reorderLevel: Number(raw.minimumStock ?? raw.reorderLevel ?? 0),
                description: raw.description ? String(raw.description) : null,
                location: raw.location ? String(raw.location) : null,
                imageUrl: raw.imageUrl ? String(raw.imageUrl) : null,
                expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
                autoDeleteAt: raw.autoDeleteAt ? String(raw.autoDeleteAt) : null,
                autoDeleteEnabled: Boolean(raw.autoDeleteEnabled ?? false),
                isSalesPriceInclusiveGst: Boolean(raw.isSalesPriceInclusiveGst ?? false),
                trackStock: true,
                isActive: Boolean(raw.isActive ?? true),
                createdAt: String(raw.createdAt ?? new Date().toISOString()),
                updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
            } as Item,
        };
    },
    create: (data: Omit<Item, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>) =>
        api.post<ApiOkResponse>('/api/items', {
            name: data.name,
            price: data.salePrice,
            stock: data.stock,
            purchasePrice: data.purchasePrice,
            mrp: data.mrp,
            minimumStock: data.reorderLevel,
            unit: data.unit ?? 'pcs',
            hsn: data.hsnCode ?? undefined,
            gstPercentage: data.gstRate,
            category: data.category ?? undefined,
            description: data.description ?? undefined,
            location: data.location ?? undefined,
            barcode: data.barcode ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            isActive: data.isActive,
            autoDeleteEnabled: data.autoDeleteEnabled,
            autoDeleteAt: data.autoDeleteAt ?? undefined,
            expiresAt: data.expiresAt ?? undefined,
        }),
    upsert: (data: Partial<Item> & { price?: number; salePrice?: number }) =>
        api.post<ApiOkResponse>('/api/items', {
            id: data.id,
            name: data.name,
            price: data.salePrice ?? data.price ?? 0,
            stock: data.stock ?? 0,
            purchasePrice: data.purchasePrice,
            mrp: data.mrp,
            minimumStock: data.reorderLevel,
            unit: data.unit ?? 'pcs',
            hsn: data.hsnCode ?? undefined,
            gstPercentage: data.gstRate,
            category: data.category ?? undefined,
            description: data.description ?? undefined,
            location: data.location ?? undefined,
            barcode: data.barcode ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            isActive: data.isActive,
            autoDeleteEnabled: data.autoDeleteEnabled,
            autoDeleteAt: data.autoDeleteAt ?? undefined,
            expiresAt: data.expiresAt ?? undefined,
        }),
    update: (id: string, data: Partial<Item>) =>
        api.patch<ApiOkResponse>(`/api/items/${id}`, {
            name: data.name,
            price: data.salePrice,
            stock: data.stock,
            purchasePrice: data.purchasePrice,
            mrp: data.mrp,
            minimumStock: data.reorderLevel,
            unit: data.unit,
            hsn: data.hsnCode,
            gstPercentage: data.gstRate,
            category: data.category,
            description: data.description,
            location: data.location,
            barcode: data.barcode,
            imageUrl: data.imageUrl,
            isActive: data.isActive,
            autoDeleteEnabled: data.autoDeleteEnabled,
            autoDeleteAt: data.autoDeleteAt ?? undefined,
            expiresAt: data.expiresAt ?? undefined,
        }),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/items/${id}`),
    adjustStock: (id: string, data: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) =>
        api.post<ApiOkResponse>(`/api/items/${id}/adjust`, data),
    getLedger: (id: string, params?: PaginationParams) =>
        api.get<ApiResponse<unknown[]>>(`/api/items/${id}/ledger`, { params }),
};

// ─── Invoices / Transactions ──────────────────────────────────────────────────

export const invoiceApi = {
    list: (params?: { type?: string; status?: string; from?: string; to?: string } & PaginationParams) =>
        api.get<ApiListResponse<Invoice>>('/api/transactions', { params }),
    get: (id: string) =>
        api.get<ApiResponse<Invoice>>(`/api/transactions/${id}`),
    create: (data: Partial<InvoiceBuilderState> & { invoiceType: string }) =>
        api.post<ApiResponse<Invoice>>('/api/transactions', data),
    update: (id: string, data: Partial<InvoiceBuilderState>) =>
        api.put<ApiResponse<Invoice>>(`/api/transactions/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/transactions/${id}`),
    recordPayment: (id: string, data: { paidAmount: number; paymentMode: string; date?: string }) =>
        api.post<ApiOkResponse>(`/api/transactions/${id}/payment`, data),
};

// ─── POS ─────────────────────────────────────────────────────────────────────

export const posApi = {
    createSale: (data: {
        partyId?: string;
        items: Array<{ itemId?: string; description: string; quantity: number; rate: number; gstRate?: number; discountPercent?: number; isInterState?: boolean; unit?: string }>;
        paymentMode: string;
        paidAmount: number;
        discountAmount?: number;
        roundOffAmount?: number;
        notes?: string;
        placeOfSupply?: string;
    }) => api.post<ApiResponse<Invoice>>('/api/pos/sale', data),
    getSale: (id: string) =>
        api.get<ApiResponse<Invoice & { items: unknown[] }>>(`/api/pos/sale/${id}`),
    listSales: (params?: PaginationParams) =>
        api.get<ApiListResponse<Invoice>>('/api/pos/sales', { params }),
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenseApi = {
    list: (params?: { category?: string } & PaginationParams & DateRangeParams) =>
        api.get<ApiListResponse<Expense>>('/api/expenses', { params }),
    get: (id: string) =>
        api.get<ApiResponse<Expense>>(`/api/expenses/${id}`),
    create: (data: Omit<Expense, 'id' | 'businessId' | 'createdByUserId' | 'isDeleted' | 'createdAt' | 'updatedAt'>) =>
        api.post<ApiResponse<Expense>>('/api/expenses', data),
    update: (id: string, data: Partial<Expense>) =>
        api.put<ApiResponse<Expense>>(`/api/expenses/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/expenses/${id}`),
    getByCategorySummary: (params?: DateRangeParams) =>
        api.get<ApiResponse<Array<{ category: string; total: number; count: number }>>>('/api/expenses/reports/by-category', { params }),
};

// ─── Loans ────────────────────────────────────────────────────────────────────

export const loanApi = {
    list: () =>
        api.get<ApiListResponse<Loan>>('/api/loans'),
    get: (id: string) =>
        api.get<ApiResponse<Loan>>(`/api/loans/${id}`),
    create: (data: Omit<Loan, 'id' | 'businessId' | 'currentBalance' | 'createdAt' | 'updatedAt' | 'transactions'>) =>
        api.post<ApiResponse<Loan>>('/api/loans', data),
    update: (id: string, data: Partial<Loan>) =>
        api.put<ApiResponse<Loan>>(`/api/loans/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/loans/${id}`),
    addTransaction: (loanId: string, data: { transactionType: 'DISBURSEMENT' | 'REPAYMENT' | 'INTEREST'; amount: number; date?: string; notes?: string }) =>
        api.post<ApiResponse<LoanTransaction>>(`/api/loans/${loanId}/transactions`, data),
    getTransactions: (loanId: string) =>
        api.get<ApiListResponse<LoanTransaction>>(`/api/loans/${loanId}/transactions`),
};

// ─── Godowns ──────────────────────────────────────────────────────────────────

export const godownApi = {
    list: () =>
        api.get<ApiListResponse<Godown>>('/api/godowns'),
    create: (data: { name: string; address?: string; isDefault?: boolean }) =>
        api.post<ApiResponse<Godown>>('/api/godowns', data),
    update: (id: string, data: Partial<Godown>) =>
        api.put<ApiResponse<Godown>>(`/api/godowns/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/godowns/${id}`),
    getStock: (id: string) =>
        api.get<ApiResponse<GodownStockEntry[]>>(`/api/godowns/${id}/stock`),
    transfer: (data: { fromGodownId: string; toGodownId: string; itemId: string; quantity: number; notes?: string }) =>
        api.post<ApiOkResponse>('/api/godowns/transfer', data),
    getTransfers: (params?: PaginationParams) =>
        api.get<ApiListResponse<StockTransfer>>('/api/godowns/transfers', { params }),
};

// ─── Cash & Bank ──────────────────────────────────────────────────────────────

export const cashBankApi = {
    getOperations: () =>
        api.get<ApiResponse<{
            operations: {
                bankAccount: string[];
                cashInHand: string[];
                cheque: string[];
            };
            voucherMapping: Record<string, string>;
        }>>('/api/cash-bank/operations'),
    getBalances: () =>
        api.get<ApiResponse<Account[]>>('/api/cash-bank/balances'),
    getSummary: () =>
        api.get<ApiResponse<{
            accounts: Account[];
            recentVouchers: unknown[];
            totalBalance: number;
        }>>('/api/cash-bank/summary'),
    contra: (data: { fromAccountId: string; toAccountId: string; amount: number; narration?: string; date?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/contra', data),
    deposit: (data: { accountId: string; amount: number; paymentMode?: string; description?: string; date?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/deposit', data),
    withdraw: (data: { accountId: string; amount: number; paymentMode?: string; description?: string; date?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/withdraw', data),
    transfer: (data: { fromAccountId: string; toAccountId: string; amount: number; description?: string; date?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/transfer', data),
    receiveCheque: (data: { chequeAccountId: string; amount: number; chequeNumber: string; chequeDate?: string; partyId?: string; narration?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/receive', data),
    depositCheque: (data: { chequeAccountId: string; bankAccountId: string; amount: number; date?: string; narration?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/deposit', data),
    bounceCheque: (data: { chequeAccountId: string; bankAccountId: string; amount: number; date?: string; reason?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/bounce', data),
    getLedger: (accountId: string, params?: PaginationParams) =>
        api.get<ApiResponse<unknown[]>>(`/api/cash-bank/ledger/${accountId}`, { params }),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
    getAll: () =>
        api.get<ApiResponse<BusinessSettingsMap>>('/api/settings'),
    getSchema: () =>
        api.get<{ ok: boolean; sections: string[]; schema: Record<string, SettingsFieldDefinition[]> }>('/api/settings/schema'),
    get: (section: string) =>
        api.get<ApiResponse<Record<string, unknown>>>(`/api/settings/${section}`),
    getSection: (section: string) =>
        api.get<ApiResponse<Record<string, unknown>>>(`/api/settings/${section}`),
    update: (section: string, body: { data: Record<string, unknown> }) =>
        api.put<ApiResponse<Record<string, unknown>>>(`/api/settings/${section}`, body),
    updateSection: (section: string, data: Record<string, unknown>) =>
        api.put<ApiResponse<Record<string, unknown>>>(`/api/settings/${section}`, { data }),
    resetSection: (section: string) =>
        api.delete<ApiOkResponse>(`/api/settings/${section}`),
};

// ─── Reporting ────────────────────────────────────────────────────────────────

export const reportApi = {
    getSummary: (params?: DateRangeParams) =>
        api.get<ApiResponse<unknown>>('/api/reporting/summary', { params }),
    getSalesTrend: (params?: DateRangeParams & { granularity?: 'daily' | 'weekly' | 'monthly' }) =>
        api.get<ApiResponse<unknown[]>>('/api/reporting/sales-trend', { params }),
    getGstr1: (params: { month: number; year: number }) =>
        api.get<ApiResponse<unknown>>('/api/reporting/gstr1', { params }),
    getGstr3b: (params: { month: number; year: number }) =>
        api.get<ApiResponse<unknown>>('/api/reporting/gstr3b', { params }),
};

// ─── Subscription ─────────────────────────────────────────────────────────────

export const subscriptionApi = {
    get: () =>
        api.get<ApiResponse<Subscription>>('/api/subscription'),
    getPlans: () =>
        api.get<{ ok: boolean; plans: Plan[] }>('/api/subscription/plans'),
    upgrade: (data: { tier: string }) =>
        api.post<ApiOkResponse>('/api/subscription/upgrade', data),
    createCheckoutSession: (data: { planId: string; discountCode?: string }) =>
        api.post<ApiResponse<{
            intentId: string;
            checkoutUrl: string;
            provider: string;
            amount: number;
            appliedDiscount: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null;
        }>>('/api/subscription/checkout', data),
    getIntentStatus: (intentId: string) =>
        api.get<ApiResponse<{ status: 'pending' | 'succeeded' | 'failed' | 'canceled'; provider: string }>>(`/api/subscription/intents/${intentId}/status`),
    validateDiscount: (data: { code: string; planId?: string }) =>
        api.post<ApiResponse<{
            discount: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number };
            plan: { id: string; tier: string; billingCycle: string | null; pricePerCycle: number } | null;
        }>>('/api/subscription/discounts/validate', data),
    getActiveOffers: () =>
        api.get<ApiResponse<Array<{ id: string; title: string; message: string; ctaText?: string | null; ctaRoute?: string | null }>>>('/api/subscription/offers/active'),
};

// ─── Offers ───────────────────────────────────────────────────────────────────

export const offerApi = {
    getActive: () =>
        api.get<ApiListResponse<Offer>>('/api/operations/offers'),
};
