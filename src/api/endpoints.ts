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
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';

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
        api.get<ApiListResponse<Business>>('/api/organizations/mine'),
    get: (_id: string) =>
        api.get<ApiResponse<Business>>('/api/organizations/current'),
    create: (data: Partial<Business>) =>
        api.post<ApiResponse<Business>>('/api/organizations', data),
    update: (id: string, data: Partial<Business>) =>
        api.patch<ApiResponse<Business>>(`/api/organizations/${id}`, data),
    getSubscription: async () => {
        const res = await api.get<ApiResponse<{ subscription?: Subscription | null }>>('/api/users/me');
        return {
            ...res,
            data: res.data?.subscription ?? null,
        } as ApiResponse<Subscription>;
    },
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
        api.patch<ApiResponse<Party>>(`/api/parties/${id}`, data),
    delete: (id: string) =>
        api.patch<ApiOkResponse>(`/api/parties/${id}`, { isActive: false }),
};

// ─── Items ────────────────────────────────────────────────────────────────────

export const itemApi = {
    list: async (params?: { q?: string; limit?: number }) => {
        const res = await api.get<{ ok: boolean; items: Record<string, unknown>[] }>('/api/items', { params });
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
    recordPayment: (id: string, data: { paidAmount: number; paymentMode: string; date?: string }) =>
        api.patch<ApiOkResponse>(`/api/transactions/${id}/payment`, data),
};

// ─── POS ─────────────────────────────────────────────────────────────────────

export const posApi = {
    createSale: (data: {
        partyId?: string;
        items: { itemId?: string; description: string; quantity: number; rate: number; gstRate?: number; discountPercent?: number; isInterState?: boolean; unit?: string }[];
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
    recycleBin: (params?: PaginationParams) =>
        api.get<ApiListResponse<Expense>>('/api/expenses/recycle-bin', { params }),
    get: (id: string) =>
        api.get<ApiResponse<Expense>>(`/api/expenses/${id}`),
    create: (data: Omit<Expense, 'id' | 'businessId' | 'createdByUserId' | 'isDeleted' | 'createdAt' | 'updatedAt'>) =>
        api.post<ApiResponse<Expense>>('/api/expenses', data),
    update: (id: string, data: Partial<Expense>) =>
        api.put<ApiResponse<Expense>>(`/api/expenses/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/expenses/${id}`),
    restore: (id: string) =>
        api.post<ApiOkResponse>(`/api/expenses/${id}/restore`, {}),
    permanentDelete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/expenses/${id}/permanent`),
    getByCategorySummary: (params?: DateRangeParams) =>
        api.get<ApiResponse<{ category: string; total: number; count: number }[]>>('/api/expenses/reports/by-category', { params }),
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
    getTransactions: async (loanId: string) => {
        const res = await api.get<ApiResponse<{ transactions?: LoanTransaction[] }>>(`/api/loans/${loanId}`);
        return {
            ...res,
            data: (res.data?.transactions ?? []).map((entry) => ({
                ...entry,
                type: entry.type ?? entry.transactionType,
                description: entry.description ?? entry.notes ?? null,
            })),
        } as ApiListResponse<LoanTransaction>;
    },
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
    getSummary: async (params?: DateRangeParams) => {
        const res = await api.get<ApiResponse<{
            totalIncome?: number;
            totalExpenses?: number;
            netProfit?: number;
        }>>('/api/reporting/pnl', { params });

        const totalSales = Number(res.data?.totalIncome ?? 0);
        const totalExpenses = Number(res.data?.totalExpenses ?? 0);
        const netProfit = Number(res.data?.netProfit ?? (totalSales - totalExpenses));

        return {
            ...res,
            data: {
                totalSales,
                totalPurchases: 0,
                grossProfit: netProfit,
                totalExpenses,
                netProfit,
                totalTaxCollected: 0,
                outstandingReceivables: 0,
                outstandingPayables: 0,
            },
        };
    },
    getSalesTrend: (params?: DateRangeParams & { granularity?: 'daily' | 'weekly' | 'monthly' }) =>
        api.get<ApiResponse<unknown[]>>('/api/reporting/export/transactions', { params }),
    getGstr1: (params: { month: number; year: number }) =>
        api.get<ApiResponse<unknown>>('/api/accounting/gst/summary', { params }),
    getGstr3b: (params: { month: number; year: number }) =>
        api.get<ApiResponse<unknown>>('/api/accounting/gst/summary', { params }),
};

// ─── Subscription ─────────────────────────────────────────────────────────────

export const subscriptionApi = {
    get: async () => {
        const res = await api.get<ApiResponse<{ subscription?: Subscription | null }>>('/api/users/me');
        return {
            ...res,
            data: res.data?.subscription ?? null,
        } as ApiResponse<Subscription>;
    },
    getPlans: () =>
        api.get<{ ok: boolean; plans: Plan[] }>('/api/subscription/plans'),
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
        api.get<ApiResponse<{ id: string; title: string; message: string; ctaText?: string | null; ctaRoute?: string | null }[]>>('/api/subscription/offers/active'),
};

// ─── Offers ───────────────────────────────────────────────────────────────────

export const offerApi = {
    getActive: () =>
        api.get<ApiListResponse<Offer>>('/api/subscription/offers/active'),
};

const nowIso = () => new Date().toISOString();

const toItemSyncPayload = (item: Item): Record<string, unknown> & { id: string } => ({
    id: item.id,
    name: item.name,
    price: item.salePrice,
    stock: item.stock,
    purchasePrice: item.purchasePrice,
    mrp: item.mrp,
    minimumStock: item.reorderLevel,
    unit: item.unit ?? 'pcs',
    hsn: item.hsnCode ?? undefined,
    gstPercentage: item.gstRate,
    category: item.category ?? undefined,
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    barcode: item.barcode ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
    isActive: item.isActive,
    autoDeleteEnabled: item.autoDeleteEnabled,
    autoDeleteAt: item.autoDeleteAt ?? undefined,
    expiresAt: item.expiresAt ?? undefined,
});

const toPartySyncPayload = (party: Party): Record<string, unknown> & { id: string } => ({
    id: party.id,
    type: party.type,
    name: party.name,
    phone: party.phone ?? undefined,
    email: party.email ?? undefined,
    billingAddress: party.billingAddress ?? undefined,
    shippingAddress: party.shippingAddress ?? undefined,
    gstin: party.gstin ?? undefined,
    openingBalance: party.openingBalance,
    creditLimit: party.creditLimit,
    loyaltyPoints: party.loyaltyPoints,
    isActive: party.isActive,
});

const buildLocalItem = (params: {
    id: string;
    input: Partial<Item> & { name: string };
    base?: Item;
}): Item => {
    const { id, input, base } = params;
    const now = nowIso();
    return {
        id,
        businessId: base?.businessId ?? 'offline',
        name: input.name,
        sku: input.sku ?? base?.sku ?? null,
        barcode: input.barcode ?? base?.barcode ?? null,
        hsnCode: input.hsnCode ?? base?.hsnCode ?? null,
        unit: input.unit ?? base?.unit ?? 'pcs',
        category: input.category ?? base?.category ?? null,
        mrp: Number(input.mrp ?? base?.mrp ?? 0),
        purchasePrice: Number(input.purchasePrice ?? base?.purchasePrice ?? 0),
        salePrice: Number(input.salePrice ?? base?.salePrice ?? 0),
        gstRate: Number(input.gstRate ?? base?.gstRate ?? 0),
        openingStock: Number(input.openingStock ?? base?.openingStock ?? input.stock ?? 0),
        stock: Number(input.stock ?? base?.stock ?? 0),
        reorderLevel: Number(input.reorderLevel ?? base?.reorderLevel ?? 0),
        description: input.description ?? base?.description ?? null,
        location: input.location ?? base?.location ?? null,
        imageUrl: input.imageUrl ?? base?.imageUrl ?? null,
        expiresAt: input.expiresAt ?? base?.expiresAt ?? null,
        autoDeleteAt: input.autoDeleteAt ?? base?.autoDeleteAt ?? null,
        autoDeleteEnabled: Boolean(input.autoDeleteEnabled ?? base?.autoDeleteEnabled ?? false),
        isSalesPriceInclusiveGst: Boolean(
            input.isSalesPriceInclusiveGst ?? base?.isSalesPriceInclusiveGst ?? false
        ),
        trackStock: Boolean(input.trackStock ?? base?.trackStock ?? true),
        isActive: Boolean(input.isActive ?? base?.isActive ?? true),
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
    };
};

const buildLocalParty = (params: {
    id: string;
    input: Partial<Party> & { name: string; type: Party['type'] };
    base?: Party;
}): Party => {
    const { id, input, base } = params;
    const now = nowIso();
    return {
        id,
        businessId: base?.businessId ?? 'offline',
        type: input.type,
        name: input.name,
        phone: input.phone ?? base?.phone ?? null,
        email: input.email ?? base?.email ?? null,
        billingAddress: input.billingAddress ?? base?.billingAddress ?? null,
        shippingAddress: input.shippingAddress ?? base?.shippingAddress ?? null,
        gstin: input.gstin ?? base?.gstin ?? null,
        openingBalance: Number(input.openingBalance ?? base?.openingBalance ?? 0),
        creditLimit: Number(input.creditLimit ?? base?.creditLimit ?? 0),
        loyaltyPoints: Number(input.loyaltyPoints ?? base?.loyaltyPoints ?? 0),
        isActive: Boolean(input.isActive ?? base?.isActive ?? true),
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
    };
};

const resolveInvoicePaymentStatus = (
    totalAmount: number,
    paidAmount: number
): Invoice['paymentStatus'] => {
    if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
    if (paidAmount > 0) return 'PARTIALLY_PAID';
    return 'UNPAID';
};

const buildLocalInvoiceFromBuilder = (
    payload: Partial<InvoiceBuilderState> & { invoiceType: string }
): Invoice => {
    const now = nowIso();
    const id = offlineSyncService.createLocalId('inv');
    const items = payload.items ?? [];
    const totalTaxableValue = items.reduce(
        (sum, line) => sum + Number(line.taxableValue),
        0
    );
    const totalTaxAmount = items.reduce(
        (sum, line) =>
            sum
            + Number(line.cgstAmount ?? 0)
            + Number(line.sgstAmount ?? 0)
            + Number(line.igstAmount ?? 0),
        0
    );
    const totalInvoiceValue =
        Number(payload.additionalCharges ?? 0)
        + totalTaxableValue
        + totalTaxAmount
        - Number(payload.discountAmount ?? 0)
        + Number(payload.roundOffAmount ?? 0);
    const paidAmount = Number(payload.paidAmount ?? 0);

    return {
        id,
        businessId: 'offline',
        invoiceType: payload.invoiceType as Invoice['invoiceType'],
        invoiceNumber:
            payload.invoiceNumber
            || `OFF-${new Date().getFullYear()}-${id.slice(-6).toUpperCase()}`,
        invoiceDate: payload.invoiceDate ?? now,
        partyId: payload.partyId ?? null,
        placeOfSupply: payload.placeOfSupply ?? null,
        totalTaxableValue,
        totalTaxAmount,
        totalInvoiceValue,
        discountAmount: Number(payload.discountAmount ?? 0),
        roundOffAmount: Number(payload.roundOffAmount ?? 0),
        additionalCharges: Number(payload.additionalCharges ?? 0),
        reverseCharge: Boolean(payload.reverseCharge ?? false),
        gstRateBreakupJson: {},
        eInvoiceIrn: null,
        eInvoiceStatus: null,
        eWayBillNumber: null,
        paymentStatus: resolveInvoicePaymentStatus(totalInvoiceValue, paidAmount),
        paidAmount,
        dueDate: payload.dueDate ?? null,
        notes: payload.notes ?? null,
        termsAndConditions: payload.termsAndConditions ?? null,
        sourceVoucherType: null,
        sourceVoucherId: null,
        isDeleted: false,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
        items: (payload.items ?? []).map((line, index) => ({
            id: `${id}-${index + 1}`,
            invoiceId: id,
            itemId: line.itemId ?? null,
            description: line.description,
            quantity: Number(line.quantity ?? 0),
            unit: line.unit ?? 'pcs',
            rate: Number(line.rate ?? 0),
            discountPercent: Number(line.discountPercent ?? 0),
            discountAmount: Number(line.discountAmount ?? 0),
            taxableValue: Number(line.taxableValue),
            gstRate: Number(line.gstRate ?? 0),
            cgstRate: Number(line.cgstRate ?? 0),
            cgstAmount: Number(line.cgstAmount ?? 0),
            sgstRate: Number(line.sgstRate ?? 0),
            sgstAmount: Number(line.sgstAmount ?? 0),
            igstRate: Number(line.igstRate ?? 0),
            igstAmount: Number(line.igstAmount ?? 0),
            cessRate: 0,
            cessAmount: 0,
            total: Number(line.total ?? 0),
            sortOrder: index,
        })),
        partySnapshot: payload.partySnapshot
            ? {
                  name: payload.partySnapshot.name ?? 'Walk-in Customer',
                  gstin: payload.partySnapshot.gstin ?? null,
                  phone: payload.partySnapshot.phone ?? null,
                  address: payload.partySnapshot.billingAddress ?? null,
              }
            : undefined,
        totalCgstAmount: items.reduce((sum, line) => sum + Number(line.cgstAmount ?? 0), 0),
        totalSgstAmount: items.reduce((sum, line) => sum + Number(line.sgstAmount ?? 0), 0),
        totalIgstAmount: items.reduce((sum, line) => sum + Number(line.igstAmount ?? 0), 0),
    };
};

const buildLocalExpense = (
    payload: Omit<Expense, 'id' | 'businessId' | 'createdByUserId' | 'isDeleted' | 'createdAt' | 'updatedAt'>
): Expense => {
    const now = nowIso();
    const id = offlineSyncService.createLocalId('exp');
    const expenseDate = payload.expenseDate ?? payload.date ?? now;
    return {
        id,
        businessId: 'offline',
        category: payload.category,
        accountId: payload.accountId ?? null,
        amount: Number(payload.amount ?? 0),
        date: expenseDate,
        expenseDate,
        description: payload.description ?? null,
        paymentMode: payload.paymentMode ?? 'CASH',
        partyId: payload.partyId ?? null,
        partyName: payload.partyName ?? null,
        receiptUrl: payload.receiptUrl ?? null,
        createdByUserId: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
    };
};

const buildLocalLoan = (
    payload: Omit<Loan, 'id' | 'businessId' | 'currentBalance' | 'createdAt' | 'updatedAt' | 'transactions'>
): Loan => {
    const now = nowIso();
    const id = offlineSyncService.createLocalId('loan');
    const openingDate = payload.openingDate ?? payload.startDate ?? now;
    const principal = Number(payload.openingBalance ?? payload.principalAmount ?? 0);
    return {
        id,
        businessId: 'offline',
        lenderBorrowerName: payload.lenderBorrowerName,
        loanType: payload.loanType ?? 'BORROWED',
        openingDate,
        startDate: openingDate,
        openingBalance: principal,
        principalAmount: principal,
        currentBalance: principal,
        interestRatePercent: Number(payload.interestRatePercent ?? 0),
        interestType: payload.interestType ?? 'SIMPLE',
        emiAmount: payload.emiAmount ?? null,
        dueDate: payload.dueDate ?? null,
        accountId: payload.accountId ?? null,
        partyId: payload.partyId ?? null,
        description: payload.description ?? null,
        notes: payload.notes ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        transactions: [],
    };
};

const buildLocalGodown = (payload: { name: string; address?: string; isDefault?: boolean }): Godown => {
    const now = nowIso();
    return {
        id: offlineSyncService.createLocalId('godown'),
        businessId: 'offline',
        name: payload.name,
        address: payload.address ?? null,
        managerName: null,
        isDefault: Boolean(payload.isDefault),
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };
};

const originalItemApi = {
    list: itemApi.list,
    get: itemApi.get,
    create: itemApi.create,
    upsert: itemApi.upsert,
    update: itemApi.update,
    delete: itemApi.delete,
    adjustStock: itemApi.adjustStock,
};

const originalPartyApi = {
    list: partyApi.list,
    get: partyApi.get,
    create: partyApi.create,
    update: partyApi.update,
    delete: partyApi.delete,
};

const originalInvoiceApi = {
    list: invoiceApi.list,
    get: invoiceApi.get,
    create: invoiceApi.create,
    recordPayment: invoiceApi.recordPayment,
};

const originalSettingsApi = {
    getAll: settingsApi.getAll,
    get: settingsApi.get,
    getSection: settingsApi.getSection,
    update: settingsApi.update,
    updateSection: settingsApi.updateSection,
};

const originalExpenseApi = {
    list: expenseApi.list,
    create: expenseApi.create,
};

const originalLoanApi = {
    list: loanApi.list,
    get: loanApi.get,
    create: loanApi.create,
};

const originalGodownApi = {
    list: godownApi.list,
    create: godownApi.create,
    delete: godownApi.delete,
};

const originalCashBankApi = {
    getBalances: cashBankApi.getBalances,
    deposit: cashBankApi.deposit,
    withdraw: cashBankApi.withdraw,
    transfer: cashBankApi.transfer,
};

const originalPosApi = {
    createSale: posApi.createSale,
};

itemApi.list = async (params) => {
    try {
        const response = await originalItemApi.list(params);
        await offlineSyncService.setCachedItems(response.items ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedItems();
        if (cached.length > 0) {
            return { ok: true, items: cached };
        }
        throw error;
    }
};

itemApi.get = async (id) => {
    try {
        const response = await originalItemApi.get(id);
        if (response.item) {
            await offlineSyncService.upsertCachedItem(response.item);
        }
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedItems();
        const entry = cached.find((item) => item.id === id);
        if (entry) {
            return { ok: true, item: entry };
        }
        throw error;
    }
};

itemApi.create = async (data) => {
    const localId = offlineSyncService.createLocalId('item');
    const localItem = buildLocalItem({ id: localId, input: { ...data, name: data.name } });
    await offlineSyncService.upsertCachedItem(localItem);
    try {
        return await originalItemApi.upsert({ ...data, id: localId });
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'upsert_item',
            payload: toItemSyncPayload(localItem),
        });
        return { ok: true, message: 'Saved offline and queued for sync.' };
    }
};

itemApi.update = async (id, data) => {
    const cached = await offlineSyncService.getCachedItems();
    const base = cached.find((entry) => entry.id === id);
    const localItem = buildLocalItem({
        id,
        input: {
            ...(base ?? {}),
            ...data,
            name: data.name ?? base?.name ?? 'Item',
        },
        base,
    });
    await offlineSyncService.upsertCachedItem(localItem);
    try {
        return await originalItemApi.update(id, data);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'upsert_item',
            payload: toItemSyncPayload(localItem),
        });
        return { ok: true, message: 'Updated offline and queued for sync.' };
    }
};

itemApi.delete = async (id) => {
    await offlineSyncService.removeCachedItem(id);
    try {
        return await originalItemApi.delete(id);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'delete_item',
            payload: { id },
        });
        return { ok: true, message: 'Delete queued for sync.' };
    }
};

itemApi.adjustStock = async (id, data) => {
    const cached = await offlineSyncService.getCachedItems();
    const existing = cached.find((entry) => entry.id === id);
    if (existing) {
        const current = Number(existing.stock ?? 0);
        const delta =
            data.type === 'IN' ? data.quantity : data.type === 'OUT' ? -data.quantity : data.quantity - current;
        const nextStock = data.type === 'ADJUST' ? data.quantity : current + delta;
        const updated = {
            ...existing,
            stock: nextStock,
            updatedAt: nowIso(),
        };
        await offlineSyncService.upsertCachedItem(updated);
    }
    try {
        return await originalItemApi.adjustStock(id, data);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        if (existing) {
            const latest = (await offlineSyncService.getCachedItems()).find((entry) => entry.id === id);
            if (latest) {
                await offlineSyncService.enqueueMutation({
                    type: 'upsert_item',
                    payload: toItemSyncPayload(latest),
                });
            }
        }
        return { ok: true, message: 'Stock change saved offline and queued for sync.' };
    }
};

partyApi.list = async (params) => {
    try {
        const response = await originalPartyApi.list(params);
        await offlineSyncService.setCachedParties(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedParties();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

partyApi.get = async (id) => {
    try {
        const response = await originalPartyApi.get(id);
        if (response.data) {
            await offlineSyncService.upsertCachedParty(response.data);
        }
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedParties();
        const party = cached.find((entry) => entry.id === id);
        if (party) {
            return { ok: true, data: party };
        }
        throw error;
    }
};

partyApi.create = async (data) => {
    const localParty = buildLocalParty({
        id: offlineSyncService.createLocalId('party'),
        input: { ...data, type: data.type, name: data.name },
    });
    await offlineSyncService.upsertCachedParty(localParty);
    try {
        const response = await originalPartyApi.create(data);
        if (response.data) {
            await offlineSyncService.upsertCachedParty(response.data);
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'upsert_party',
            payload: toPartySyncPayload(localParty),
        });
        return { ok: true, data: localParty, message: 'Saved offline and queued for sync.' };
    }
};

partyApi.update = async (id, data) => {
    const cached = await offlineSyncService.getCachedParties();
    const base = cached.find((entry) => entry.id === id);
    const localParty = buildLocalParty({
        id,
        input: {
            ...(base ?? {}),
            ...data,
            type: data.type ?? base?.type ?? 'CUSTOMER',
            name: data.name ?? base?.name ?? 'Party',
        },
        base,
    });
    await offlineSyncService.upsertCachedParty(localParty);
    try {
        const response = await originalPartyApi.update(id, data);
        if (response.data) {
            await offlineSyncService.upsertCachedParty(response.data);
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'upsert_party',
            payload: toPartySyncPayload(localParty),
        });
        return { ok: true, data: localParty, message: 'Update queued for sync.' };
    }
};

partyApi.delete = async (id) => {
    await offlineSyncService.archiveCachedParty(id);
    try {
        return await originalPartyApi.delete(id);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'archive_party',
            payload: { id },
        });
        return { ok: true, message: 'Delete queued for sync.' };
    }
};

invoiceApi.list = async (params) => {
    try {
        const response = await originalInvoiceApi.list(params);
        await offlineSyncService.setCachedInvoices(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedInvoices();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

invoiceApi.get = async (id) => {
    try {
        const response = await originalInvoiceApi.get(id);
        if (response.data) {
            await offlineSyncService.upsertCachedInvoice(response.data);
        }
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedInvoices();
        const invoice = cached.find((entry) => entry.id === id);
        if (invoice) {
            return { ok: true, data: invoice };
        }
        throw error;
    }
};

invoiceApi.create = async (data) => {
    const localInvoice = buildLocalInvoiceFromBuilder(data);
    await offlineSyncService.upsertCachedInvoice(localInvoice);
    try {
        const response = await originalInvoiceApi.create(data);
        if (response.data) {
            await offlineSyncService.upsertCachedInvoice(response.data);
            if (response.data.id !== localInvoice.id) {
                await offlineSyncService.removeCachedInvoice(localInvoice.id);
            }
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'create_invoice',
            payload: { ...data, localId: localInvoice.id },
        });
        return {
            ok: true,
            data: localInvoice,
            message: 'Invoice saved offline and queued for sync.',
        };
    }
};

invoiceApi.recordPayment = async (id, data) => {
    await offlineSyncService.updateCachedInvoicePayment(id, {
        paidAmount: data.paidAmount,
    });
    try {
        return await originalInvoiceApi.recordPayment(id, data);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'record_invoice_payment',
            payload: {
                invoiceId: id,
                paidAmount: data.paidAmount,
                paymentMode: data.paymentMode,
                date: data.date,
            },
        });
        return { ok: true, message: 'Payment update queued for sync.' };
    }
};

settingsApi.getAll = async () => {
    try {
        const response = await originalSettingsApi.getAll();
        const all = response.data ?? {};
        for (const [section, sectionData] of Object.entries(all)) {
            await offlineSyncService.setCachedSettingsSection(
                section,
                (sectionData ?? {}) as Record<string, unknown>
            );
        }
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getAllCachedSettings();
        if (Object.keys(cached).length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

settingsApi.get = async (section) => {
    const normalizedSection = section.toUpperCase();
    try {
        const response = await originalSettingsApi.get(normalizedSection);
        await offlineSyncService.setCachedSettingsSection(
            normalizedSection,
            (response.data ?? {}) as Record<string, unknown>
        );
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedSettingsSection(normalizedSection);
        if (Object.keys(cached).length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

settingsApi.getSection = settingsApi.get;

settingsApi.update = async (section, body) => {
    const normalizedSection = section.toUpperCase();
    await offlineSyncService.setCachedSettingsSection(normalizedSection, body.data);
    try {
        return await originalSettingsApi.update(normalizedSection, body);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'update_settings_section',
            payload: { section: normalizedSection, data: body.data },
        });
        return {
            ok: true,
            data: body.data,
            message: 'Settings saved offline and queued for sync.',
        };
    }
};

settingsApi.updateSection = async (section, data) =>
    settingsApi.update(section, { data });

expenseApi.list = async (params) => {
    try {
        const response = await originalExpenseApi.list(params);
        await offlineSyncService.setCachedExpenses(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedExpenses();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

expenseApi.create = async (payload) => {
    const localExpense = buildLocalExpense(payload);
    await offlineSyncService.upsertCachedExpense(localExpense);
    try {
        const response = await originalExpenseApi.create(payload);
        if (response.data) {
            await offlineSyncService.upsertCachedExpense(response.data);
            if (response.data.id !== localExpense.id) {
                const remaining = (await offlineSyncService.getCachedExpenses()).filter(
                    (entry) => entry.id !== localExpense.id
                );
                await offlineSyncService.setCachedExpenses(remaining);
            }
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'create_expense',
            payload: { ...payload, localId: localExpense.id },
        });
        return {
            ok: true,
            data: localExpense,
            message: 'Expense saved offline and queued for sync.',
        };
    }
};

loanApi.list = async () => {
    try {
        const response = await originalLoanApi.list();
        await offlineSyncService.setCachedLoans(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedLoans();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

loanApi.get = async (id) => {
    try {
        const response = await originalLoanApi.get(id);
        if (response.data) {
            await offlineSyncService.upsertCachedLoan(response.data);
        }
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedLoans();
        const loan = cached.find((entry) => entry.id === id);
        if (loan) {
            return { ok: true, data: loan };
        }
        throw error;
    }
};

loanApi.create = async (payload) => {
    const localLoan = buildLocalLoan(payload);
    await offlineSyncService.upsertCachedLoan(localLoan);
    try {
        const response = await originalLoanApi.create(payload);
        if (response.data) {
            await offlineSyncService.upsertCachedLoan(response.data);
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'create_loan',
            payload: { ...payload, localId: localLoan.id },
        });
        return {
            ok: true,
            data: localLoan,
            message: 'Loan saved offline and queued for sync.',
        };
    }
};

godownApi.list = async () => {
    try {
        const response = await originalGodownApi.list();
        await offlineSyncService.setCachedGodowns(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedGodowns();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

godownApi.create = async (payload) => {
    const localGodown = buildLocalGodown(payload);
    await offlineSyncService.upsertCachedGodown(localGodown);
    try {
        const response = await originalGodownApi.create(payload);
        if (response.data) {
            await offlineSyncService.upsertCachedGodown(response.data);
            if (response.data.id !== localGodown.id) {
                await offlineSyncService.removeCachedGodown(localGodown.id);
            }
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'create_godown',
            payload: { ...payload, localId: localGodown.id },
        });
        return {
            ok: true,
            data: localGodown,
            message: 'Godown saved offline and queued for sync.',
        };
    }
};

godownApi.delete = async (id) => {
    await offlineSyncService.removeCachedGodown(id);
    try {
        return await originalGodownApi.delete(id);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'delete_godown',
            payload: { id },
        });
        return { ok: true, message: 'Delete queued for sync.' };
    }
};

cashBankApi.getBalances = async () => {
    try {
        const response = await originalCashBankApi.getBalances();
        await offlineSyncService.setCachedCashBankAccounts(response.data ?? []);
        return response;
    } catch (error) {
        const cached = await offlineSyncService.getCachedCashBankAccounts();
        if (cached.length > 0) {
            return { ok: true, data: cached };
        }
        throw error;
    }
};

cashBankApi.deposit = async (payload) => {
    try {
        return await originalCashBankApi.deposit(payload);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'cash_bank_deposit',
            payload,
        });
        return { ok: true, message: 'Deposit queued for sync.' };
    }
};

cashBankApi.withdraw = async (payload) => {
    try {
        return await originalCashBankApi.withdraw(payload);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'cash_bank_withdraw',
            payload,
        });
        return { ok: true, message: 'Withdraw queued for sync.' };
    }
};

cashBankApi.transfer = async (payload) => {
    try {
        return await originalCashBankApi.transfer(payload);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'cash_bank_transfer',
            payload,
        });
        return { ok: true, message: 'Transfer queued for sync.' };
    }
};

posApi.createSale = async (payload) => {
    const local = buildLocalInvoiceFromBuilder({
        invoiceType: 'POS_BILL',
        invoiceDate: nowIso(),
        partyId: payload.partyId ?? null,
        items: payload.items.map((entry) => ({
            _key: offlineSyncService.createLocalId('line'),
            itemId: entry.itemId ?? null,
            description: entry.description,
            quantity: Number(entry.quantity ?? 0),
            unit: entry.unit ?? 'pcs',
            rate: Number(entry.rate ?? 0),
            discountPercent: Number(entry.discountPercent ?? 0),
            gstRate: Number(entry.gstRate ?? 0),
            isInterState: Boolean(entry.isInterState),
            discountAmount: 0,
            taxableValue: Number(entry.quantity ?? 0) * Number(entry.rate ?? 0),
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: Number(entry.gstRate ?? 0),
            igstAmount: 0,
            total: Number(entry.quantity ?? 0) * Number(entry.rate ?? 0),
        })),
        paidAmount: payload.paidAmount,
        notes: payload.notes ?? '',
        discountAmount: payload.discountAmount ?? 0,
        roundOffAmount: payload.roundOffAmount ?? 0,
    });
    await offlineSyncService.upsertCachedInvoice(local);
    try {
        const response = await originalPosApi.createSale(payload);
        if (response.data) {
            await offlineSyncService.upsertCachedInvoice(response.data);
            if (response.data.id !== local.id) {
                await offlineSyncService.removeCachedInvoice(local.id);
            }
        }
        return response;
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'create_pos_sale',
            payload,
        });
        return {
            ok: true,
            data: local,
            message: 'POS bill saved offline and queued for sync.',
        };
    }
};
