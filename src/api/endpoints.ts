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
import type {
    User,
    Business,
    Subscription,
    Party,
    Item,
    Invoice,
    InvoiceBuilderState,
    Expense,
    Loan,
    LoanTransaction,
    Godown,
    GodownStockEntry,
    StockTransfer,
    Account,
    BusinessSettingsMap,
    Plan,
    Offer,
    StaffMember,
    StaffInvite,
    OperationsControls,
    FinancialPeriod,
    OperationApproval,
    OperationApprovalActionType,
    OperationApprovalStatus,
    OperationsAuditLog,
} from '../types/domain';
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
    list: async () => {
        const res = await api.get<{
            ok: boolean;
            organizations?: Record<string, unknown>[];
            message?: string;
        }>('/api/organizations/mine', {
            skipOrganizationHeader: true,
        });
        if (!res.ok) {
            throw new Error(res.message ?? 'Failed to load businesses.');
        }
        const data = (res.organizations ?? []).map((org) => ({
            id: String(org.id ?? ''),
            ownerUserId: 'unknown',
            name: String(org.name ?? ''),
            legalName: null,
            address: typeof org.address === 'string' ? org.address : null,
            state: typeof org.state === 'string' ? org.state : null,
            city: typeof org.city === 'string' ? org.city : null,
            pincode: typeof org.pincode === 'string' ? org.pincode : null,
            gstin: null,
            pan: null,
            booksStartDate: typeof org.booksStartDate === 'string' ? org.booksStartDate : null,
            openingCashInHand: typeof org.openingCashInHand === 'number' ? org.openingCashInHand : null,
            openingCashInBank: typeof org.openingCashInBank === 'number' ? org.openingCashInBank : null,
            logoUrl: null,
            phone: null,
            email: null,
            currency: typeof org.currency === 'string' ? org.currency : 'INR',
            category: null,
            code: typeof org.code === 'string' ? org.code : null,
            isActive: true,
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })) as Business[];
        return { ok: true, data } as ApiListResponse<Business>;
    },
    get: async (_id: string) => {
        const res = await api.get<{
            ok: boolean;
            organization?: Record<string, unknown>;
            message?: string;
        }>('/api/organizations/current');
        if (!res.ok || !res.organization) {
            throw new Error(res.message ?? 'Failed to load current business.');
        }
        const org = res.organization;
        const data = {
            id: String(org.id ?? ''),
            ownerUserId: String(org.userId ?? ''),
            name: String(org.name ?? ''),
            legalName: typeof org.legalName === 'string' ? org.legalName : null,
            address: typeof org.address === 'string' ? org.address : null,
            state: typeof org.state === 'string' ? org.state : null,
            city: typeof org.city === 'string' ? org.city : null,
            pincode: typeof org.pincode === 'string' ? org.pincode : null,
            gstin: typeof org.gstNumber === 'string' ? org.gstNumber : null,
            pan: typeof org.pan === 'string' ? org.pan : null,
            booksStartDate: typeof org.booksStartDate === 'string' ? org.booksStartDate : null,
            openingCashInHand: typeof org.openingCashInHand === 'number' ? org.openingCashInHand : null,
            openingCashInBank: typeof org.openingCashInBank === 'number' ? org.openingCashInBank : null,
            logoUrl: null,
            phone: typeof org.phoneNumber === 'string' ? org.phoneNumber : null,
            email: typeof org.email === 'string' ? org.email : null,
            currency: typeof org.currency === 'string' ? org.currency : 'INR',
            category: null,
            code: typeof org.code === 'string' ? org.code : null,
            isActive: true,
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as Business;
        return { ok: true, data } as ApiResponse<Business>;
    },
    create: async (data: Partial<Business>) => {
        const res = await api.post<{ ok: boolean; id?: string; message?: string }>('/api/organizations', {
            name: data.name,
            code: data.code,
            currency: data.currency,
            phoneNumber: data.phone ?? undefined,
            email: data.email ?? undefined,
            gstNumber: data.gstin ?? undefined,
            address: data.address ?? undefined,
            legalName: data.legalName ?? undefined,
            state: data.state ?? undefined,
            city: data.city ?? undefined,
            pincode: data.pincode ?? undefined,
            booksStartDate: data.booksStartDate ?? undefined,
            openingCashInHand: typeof data.openingCashInHand === 'number' ? data.openingCashInHand : undefined,
            openingCashInBank: typeof data.openingCashInBank === 'number' ? data.openingCashInBank : undefined,
        }, {
            skipOrganizationHeader: true,
        });
        if (!res.ok || !res.id) {
            throw new Error(res.message ?? 'Failed to create business.');
        }
        return { ok: true, data: { id: res.id } } as ApiResponse<{ id: string }>;
    },
    remove: async (id: string) => {
        const res = await api.delete<{ ok: boolean; message?: string }>(`/api/organizations/${id}`, {
            skipOrganizationHeader: true,
        });
        if (!res.ok) {
            throw new Error(res.message ?? 'Failed to delete business.');
        }
        return { ok: true } as ApiOkResponse;
    },
    update: async (id: string, data: Partial<Business>) =>
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
    list: async (params?: { q?: string; type?: string } & PaginationParams & { includeInactive?: boolean }) => {
        const mappedType = params?.type?.toLowerCase() === 'customer'
            ? 'customer'
            : params?.type?.toLowerCase() === 'supplier'
                ? 'supplier'
                : params?.type;
        const res = await api.get<{ ok: boolean; parties: Record<string, unknown>[] }>(
            '/api/parties',
            { params: { ...params, type: mappedType } }
        );
        const mapped = (res.parties ?? []).map((raw) => ({
            id: String(raw.id),
            businessId: 'unknown',
            type: String(raw.type).toUpperCase() === 'SUPPLIER' || String(raw.type).toLowerCase() === 'supplier'
                ? 'SUPPLIER'
                : 'CUSTOMER',
            name: String(raw.name ?? ''),
            phone: raw.phone ? String(raw.phone) : null,
            email: raw.email ? String(raw.email) : null,
            billingAddress: raw.address ? String(raw.address) : null,
            shippingAddress: null,
            gstin: raw.gstNumber ? String(raw.gstNumber) : null,
            openingBalance: Number(raw.openingBalance ?? 0),
            creditLimit: Number(raw.creditLimit ?? 0),
            loyaltyPoints: Number(raw.loyaltyPoints ?? 0),
            isActive: Boolean(raw.isActive ?? true),
            createdAt: String(raw.createdAt ?? new Date().toISOString()),
            updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
        })) as Party[];
        return { ok: true, data: mapped };
    },
    recycleBin: async (params?: PaginationParams) => {
        const res = await api.get<{ ok: boolean; parties: Record<string, unknown>[] }>(
            '/api/parties/recycle-bin',
            { params }
        );
        const mapped = (res.parties ?? []).map((raw) => ({
            id: String(raw.id),
            businessId: 'unknown',
            type: String(raw.type).toUpperCase() === 'SUPPLIER' || String(raw.type).toLowerCase() === 'supplier'
                ? 'SUPPLIER'
                : 'CUSTOMER',
            name: String(raw.name ?? ''),
            phone: raw.phone ? String(raw.phone) : null,
            email: raw.email ? String(raw.email) : null,
            billingAddress: raw.address ? String(raw.address) : null,
            shippingAddress: null,
            gstin: raw.gstNumber ? String(raw.gstNumber) : null,
            openingBalance: Number(raw.openingBalance ?? 0),
            creditLimit: Number(raw.creditLimit ?? 0),
            loyaltyPoints: Number(raw.loyaltyPoints ?? 0),
            isActive: false,
            createdAt: String(raw.createdAt ?? new Date().toISOString()),
            updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
        })) as Party[];
        return { ok: true, data: mapped };
    },
    get: async (id: string) => {
        const res = await api.get<{ ok: boolean; party: Record<string, unknown> }>(`/api/parties/${id}`);
        const raw = res.party ?? {};
        const mapped = {
            id: String(raw.id ?? id),
            businessId: 'unknown',
            type: String(raw.type).toUpperCase() === 'SUPPLIER' || String(raw.type).toLowerCase() === 'supplier'
                ? 'SUPPLIER'
                : 'CUSTOMER',
            name: String(raw.name ?? ''),
            phone: raw.phone ? String(raw.phone) : null,
            email: raw.email ? String(raw.email) : null,
            billingAddress: raw.address ? String(raw.address) : null,
            shippingAddress: null,
            gstin: raw.gstNumber ? String(raw.gstNumber) : null,
            openingBalance: Number(raw.openingBalance ?? 0),
            creditLimit: Number(raw.creditLimit ?? 0),
            loyaltyPoints: Number(raw.loyaltyPoints ?? 0),
            isActive: Boolean(raw.isActive ?? true),
            createdAt: String(raw.createdAt ?? new Date().toISOString()),
            updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
        } as Party;
        return { ok: true, data: mapped };
    },
    create: (data: Omit<Party, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'loyaltyPoints'>) =>
        api.post<ApiResponse<Party>>('/api/parties', {
            name: data.name,
            type: data.type === 'SUPPLIER' ? 'supplier' : 'customer',
            phone: data.phone ?? undefined,
            email: data.email ?? undefined,
            address: data.billingAddress ?? undefined,
            gstNumber: data.gstin ?? undefined,
            isActive: data.isActive,
        }),
    update: (id: string, data: Partial<Party>) =>
        api.patch<ApiResponse<Party>>(`/api/parties/${id}`, {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.type !== undefined ? { type: data.type === 'SUPPLIER' ? 'supplier' : 'customer' } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
            ...(data.billingAddress !== undefined ? { address: data.billingAddress } : {}),
            ...(data.gstin !== undefined ? { gstNumber: data.gstin } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        }),
    delete: (id: string) =>
        api.patch<ApiOkResponse>(`/api/parties/${id}`, { isActive: false }),
    restore: (id: string) =>
        api.post<ApiOkResponse>(`/api/parties/${id}/restore`, {}),
    permanentDelete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/parties/${id}/permanent`),
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
    recycleBin: async (params?: { limit?: number }) => {
        const res = await api.get<{ ok: boolean; items: Record<string, unknown>[] }>('/api/items/recycle-bin', { params });
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
                isActive: false,
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
    restore: (id: string) =>
        api.post<ApiOkResponse>(`/api/items/${id}/restore`, {}),
    permanentDelete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/items/${id}/permanent`),
    adjustStock: (id: string, data: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) =>
        api.post<ApiOkResponse>(`/api/items/${id}/adjust`, data),
    getLedger: (id: string, params?: PaginationParams) =>
        api.get<ApiResponse<unknown[]>>(`/api/items/${id}/ledger`, { params }),
};

// ─── Invoices / Transactions ──────────────────────────────────────────────────

type TransactionType = 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD';

export type InvoiceCreateInput = Partial<InvoiceBuilderState> & {
    invoiceType: string;
    transactionType?: TransactionType;
    documentKind?: string;
    billMode?: 'GST' | 'ESTIMATE';
    compositeScheme?: boolean;
    tcsAmount?: number;
    tdsAmount?: number;
    eInvoiceIrn?: string | null;
    eInvoiceStatus?: string | null;
    eWayBillNumber?: string | null;
};

type ServerTransactionItem = {
    id?: string | null;
    name?: string | null;
    quantity?: number | string | null;
    price?: number | string | null;
    tax?: number | string | null;
    total?: number | string | null;
};

type ServerTransaction = {
    id: string;
    type?: string;
    invoiceType?: string;
    documentKind?: string;
    partyId?: string | null;
    partyName?: string | null;
    partyPhone?: string | null;
    billNumber?: string | null;
    billDate?: string | null;
    items?: ServerTransactionItem[];
    totalAmount?: number | string | null;
    discountAmount?: number | string | null;
    taxAmount?: number | string | null;
    paidAmount?: number | string | null;
    paymentMode?: string | null;
    paymentStatus?: string | null;
    billMode?: string | null;
    dueDate?: string | null;
    remark?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    placeOfSupply?: string | null;
    reverseCharge?: boolean | null;
    tcsAmount?: number | string | null;
    tdsAmount?: number | string | null;
    compositeScheme?: boolean | null;
};

type ServerTransactionListResponse = {
    ok: boolean;
    transactions?: ServerTransaction[];
};

type ServerTransactionGetResponse = {
    ok: boolean;
    transaction?: ServerTransaction;
};

type ServerTransactionCreateResponse = {
    ok: boolean;
    id?: string;
    transaction?: ServerTransaction;
    message?: string;
};

const KNOWN_SERVER_INVOICE_TYPES = new Set([
    'TAX_INVOICE',
    'BILL_OF_SUPPLY',
    'ESTIMATE',
    'PROFORMA',
    'CREDIT_NOTE_DOC',
    'DEBIT_NOTE_DOC',
    'DELIVERY_CHALLAN_DOC',
    'POS_BILL',
]);

const NON_POSTING_DOC_KINDS = new Set([
    'ESTIMATE',
    'PROFORMA',
    'SALE_ORDER',
    'PURCHASE_ORDER',
    'DELIVERY_CHALLAN_DOC',
]);

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTransactionType = (payload: InvoiceCreateInput): TransactionType => {
    const explicit = String(payload.transactionType ?? '').toUpperCase();
    if (explicit === 'SALE' || explicit === 'PURCHASE' || explicit === 'RETURN_INWARD' || explicit === 'RETURN_OUTWARD') {
        return explicit;
    }

    const rawKind = String(payload.documentKind ?? payload.invoiceType ?? '').toUpperCase();
    if (rawKind === 'PURCHASE_BILL' || rawKind === 'PURCHASE_ORDER') return 'PURCHASE';
    if (rawKind === 'DEBIT_NOTE_DOC') return 'RETURN_INWARD';
    if (rawKind === 'CREDIT_NOTE_DOC') return 'RETURN_OUTWARD';
    return 'SALE';
};

const toServerInvoiceType = (payload: InvoiceCreateInput) => {
    const requestedType = String(payload.invoiceType ?? '').toUpperCase();
    if (KNOWN_SERVER_INVOICE_TYPES.has(requestedType)) return requestedType;
    if (requestedType === 'PURCHASE_BILL') return 'TAX_INVOICE';
    if (requestedType === 'SALE_ORDER') return 'ESTIMATE';
    if (requestedType === 'PURCHASE_ORDER') return 'PROFORMA';
    return 'TAX_INVOICE';
};

const toDocumentKind = (payload: InvoiceCreateInput) => {
    const requestedKind = String(payload.documentKind ?? payload.invoiceType ?? '').trim().toUpperCase();
    return requestedKind || toServerInvoiceType(payload);
};

const toLegacyPaymentStatus = (total: number, paid: number): 'PAID' | 'PARTIAL' | 'PENDING' => {
    if (paid >= total && total > 0) return 'PAID';
    if (paid > 0) return 'PARTIAL';
    return 'PENDING';
};

const toInvoicePaymentStatus = (
    rawStatus: unknown,
    totalAmount: number,
    paidAmount: number
): Invoice['paymentStatus'] => {
    const status = String(rawStatus ?? '').toUpperCase();
    if (status === 'PAID') return 'PAID';
    if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
    if (status === 'OVERDUE') return 'OVERDUE';
    if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
    if (paidAmount > 0) return 'PARTIALLY_PAID';
    return 'UNPAID';
};

const mapBuilderToServerCreatePayload = (payload: InvoiceCreateInput) => {
    const serverInvoiceType = toServerInvoiceType(payload);
    const documentKind = toDocumentKind(payload);
    const transactionType = normalizeTransactionType(payload);
    const normalizedItems = (payload.items ?? [])
        .map((entry) => ({
            id: entry.itemId ?? undefined,
            name: (entry.description ?? '').trim(),
            quantity: toNumber(entry.quantity, 0),
            price: toNumber(entry.rate, 0),
            tax: toNumber(entry.gstRate, 0),
            total: toNumber(entry.total, toNumber(entry.quantity, 0) * toNumber(entry.rate, 0)),
        }))
        .filter((entry) => entry.name.length > 0 && entry.quantity > 0);

    if (normalizedItems.length === 0) {
        throw new Error('Add at least one item before saving.');
    }

    const taxAmount = (payload.items ?? []).reduce(
        (sum, entry) => sum + toNumber(entry.cgstAmount) + toNumber(entry.sgstAmount) + toNumber(entry.igstAmount),
        0
    );
    const itemsTotal = (payload.items ?? []).reduce(
        (sum, entry) => sum + toNumber(entry.total, toNumber(entry.quantity, 0) * toNumber(entry.rate, 0)),
        0
    );
    const totalAmount = itemsTotal + toNumber(payload.additionalCharges) - toNumber(payload.discountAmount) + toNumber(payload.roundOffAmount);
    const paidAmount = toNumber(payload.paidAmount);

    return {
        type: transactionType,
        documentKind,
        invoiceType: serverInvoiceType,
        partyId: payload.partyId ?? undefined,
        partyName: payload.partySnapshot?.name?.trim() || undefined,
        partyPhone: payload.partySnapshot?.phone?.trim() || undefined,
        billNumber: payload.invoiceNumber?.trim() || undefined,
        billDate: payload.invoiceDate || undefined,
        totalAmount,
        discountAmount: toNumber(payload.discountAmount),
        taxAmount,
        paidAmount,
        paymentMode: String(payload.paymentMode ?? 'CASH').toUpperCase(),
        paymentStatus: toLegacyPaymentStatus(totalAmount, paidAmount),
        billMode: payload.billMode ?? (NON_POSTING_DOC_KINDS.has(documentKind) ? 'ESTIMATE' : 'GST'),
        placeOfSupply: payload.placeOfSupply?.trim() || undefined,
        reverseCharge: Boolean(payload.reverseCharge ?? false),
        tcsAmount: toNumber(payload.tcsAmount),
        tdsAmount: toNumber(payload.tdsAmount),
        compositeScheme: Boolean(payload.compositeScheme ?? false),
        eInvoiceIrn: payload.eInvoiceIrn ?? undefined,
        eInvoiceStatus: payload.eInvoiceStatus ?? undefined,
        eWayBillNumber: payload.eWayBillNumber ?? undefined,
        dueDate: payload.dueDate ?? undefined,
        reminderEnabled: Boolean(payload.dueDate),
        remark: payload.notes?.trim() || undefined,
        items: normalizedItems,
    };
};

const mapServerTransactionToInvoice = (
    raw: ServerTransaction,
    fallback: Partial<Invoice> = {}
): Invoice => {
    const now = new Date().toISOString();
    const invoiceId = raw.id || fallback.id || offlineSyncService.createLocalId('inv');
    const documentKind = String(raw.documentKind ?? '').toUpperCase();
    const rawInvoiceType = String(raw.invoiceType ?? '').toUpperCase();
    const invoiceType = (KNOWN_SERVER_INVOICE_TYPES.has(rawInvoiceType)
        ? rawInvoiceType
        : KNOWN_SERVER_INVOICE_TYPES.has(documentKind)
            ? documentKind
            : 'TAX_INVOICE') as Invoice['invoiceType'];

    const mappedItems = (raw.items ?? []).map((entry, index) => {
        const quantity = toNumber(entry.quantity, 0);
        const rate = toNumber(entry.price, 0);
        const gstRate = toNumber(entry.tax, 0);
        const taxableValue = quantity * rate;
        const taxAmount = taxableValue * (gstRate / 100);
        const cgstRate = gstRate > 0 ? gstRate / 2 : 0;
        const sgstRate = gstRate > 0 ? gstRate / 2 : 0;
        const cgstAmount = taxAmount / 2;
        const sgstAmount = taxAmount / 2;
        const igstRate = 0;
        const igstAmount = 0;
        const total = toNumber(entry.total, taxableValue + taxAmount);

        return {
            id: String(entry.id ?? `${invoiceId}-${index + 1}`),
            invoiceId,
            itemId: entry.id ? String(entry.id) : null,
            description: String(entry.name ?? ''),
            quantity,
            unit: 'pcs',
            rate,
            discountPercent: 0,
            discountAmount: 0,
            taxableValue,
            gstRate,
            cgstRate,
            cgstAmount,
            sgstRate,
            sgstAmount,
            igstRate,
            igstAmount,
            cessRate: 0,
            cessAmount: 0,
            total,
            sortOrder: index,
        };
    });

    const totalTaxAmount = toNumber(
        raw.taxAmount,
        mappedItems.reduce((sum, item) => sum + item.cgstAmount + item.sgstAmount + item.igstAmount + item.cessAmount, 0)
    );
    const totalInvoiceValue = toNumber(raw.totalAmount, mappedItems.reduce((sum, item) => sum + item.total, 0));
    const paidAmount = toNumber(raw.paidAmount, 0);
    const totalTaxableValue = Math.max(totalInvoiceValue - totalTaxAmount, 0);
    const totalCgstAmount = mappedItems.reduce((sum, item) => sum + item.cgstAmount, 0);
    const totalSgstAmount = mappedItems.reduce((sum, item) => sum + item.sgstAmount, 0);
    const totalIgstAmount = mappedItems.reduce((sum, item) => sum + item.igstAmount, 0);

    return {
        id: invoiceId,
        businessId: fallback.businessId ?? 'unknown',
        invoiceType,
        invoiceNumber: String(raw.billNumber ?? fallback.invoiceNumber ?? ''),
        invoiceDate: String(raw.billDate ?? fallback.invoiceDate ?? now),
        partyId: raw.partyId ? String(raw.partyId) : (fallback.partyId ?? null),
        placeOfSupply: raw.placeOfSupply ? String(raw.placeOfSupply) : (fallback.placeOfSupply ?? null),
        totalTaxableValue,
        totalTaxAmount,
        totalInvoiceValue,
        discountAmount: toNumber(raw.discountAmount, fallback.discountAmount ?? 0),
        roundOffAmount: toNumber(fallback.roundOffAmount, 0),
        additionalCharges: toNumber(fallback.additionalCharges, 0),
        reverseCharge: Boolean(raw.reverseCharge ?? false),
        gstRateBreakupJson: {
            transactionType: String(raw.type ?? '').toUpperCase() || undefined,
            documentKind: documentKind || rawInvoiceType || undefined,
            tcsAmount: toNumber(raw.tcsAmount),
            tdsAmount: toNumber(raw.tdsAmount),
            compositeScheme: Boolean(raw.compositeScheme ?? false),
        },
        eInvoiceIrn: null,
        eInvoiceStatus: null,
        eWayBillNumber: null,
        paymentStatus: toInvoicePaymentStatus(raw.paymentStatus, totalInvoiceValue, paidAmount),
        paidAmount,
        dueDate: raw.dueDate ? String(raw.dueDate) : null,
        notes: raw.remark ? String(raw.remark) : raw.notes ? String(raw.notes) : null,
        termsAndConditions: null,
        sourceVoucherType: null,
        sourceVoucherId: null,
        isDeleted: false,
        createdByUserId: null,
        createdAt: String(raw.createdAt ?? fallback.createdAt ?? now),
        updatedAt: String(raw.updatedAt ?? fallback.updatedAt ?? now),
        items: mappedItems,
        partySnapshot: raw.partyName
            ? {
                name: String(raw.partyName),
                phone: raw.partyPhone ? String(raw.partyPhone) : null,
            }
            : undefined,
        totalCgstAmount,
        totalSgstAmount,
        totalIgstAmount,
    };
};

const fetchInvoiceByTransactionId = async (id: string): Promise<Invoice> => {
    const response = await api.get<ServerTransactionGetResponse>(`/api/transactions/${id}`);
    if (!response.ok || !response.transaction) {
        throw new Error('Transaction created but could not be fetched.');
    }
    return mapServerTransactionToInvoice(response.transaction, { id });
};

export const invoiceApi = {
    list: async (params?: { type?: string; status?: string; from?: string; to?: string } & PaginationParams) => {
        const response = await api.get<ServerTransactionListResponse>('/api/transactions', { params });
        return {
            ok: response.ok,
            data: (response.transactions ?? []).map((entry) => mapServerTransactionToInvoice(entry)),
        } as ApiListResponse<Invoice>;
    },
    get: async (id: string) => {
        const response = await api.get<ServerTransactionGetResponse>(`/api/transactions/${id}`);
        if (!response.ok || !response.transaction) {
            throw new Error('Transaction not found.');
        }
        return {
            ok: true,
            data: mapServerTransactionToInvoice(response.transaction, { id }),
        } as ApiResponse<Invoice>;
    },
    create: async (data: InvoiceCreateInput) => {
        const payload = mapBuilderToServerCreatePayload(data);
        const response = await api.post<ServerTransactionCreateResponse>('/api/transactions', payload);

        if (response.transaction) {
            return {
                ok: true,
                data: mapServerTransactionToInvoice(response.transaction),
                message: response.message,
            } as ApiResponse<Invoice>;
        }

        if (response.id) {
            try {
                const hydrated = await fetchInvoiceByTransactionId(response.id);
                return {
                    ok: true,
                    data: hydrated,
                    message: response.message,
                } as ApiResponse<Invoice>;
            } catch {
                const fallback = buildLocalInvoiceFromBuilder(data);
                fallback.id = response.id;
                return {
                    ok: true,
                    data: fallback,
                    message: response.message ?? 'Created successfully.',
                } as ApiResponse<Invoice>;
            }
        }

        throw new Error(response.message ?? 'Failed to create transaction.');
    },
    recordPayment: (id: string, data: { paidAmount: number; paymentMode: string; date?: string }) =>
        api.patch<ApiOkResponse>(`/api/transactions/${id}/payment`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/transactions/${id}`),
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
    create: (data: {
        lenderBorrowerName: string;
        loanType: 'BORROWED' | 'GIVEN';
        openingDate?: string;
        startDate?: string;
        openingBalance?: number;
        principalAmount?: number;
        interestRatePercent?: number;
        interestType?: 'SIMPLE' | 'COMPOUND';
        emiAmount?: number | null;
        dueDate?: string | null;
        partyId?: string | null;
        accountId?: string | null;
        notes?: string | null;
    }) =>
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

export const staffApi = {
    list: async () => {
        const res = await api.get<{ ok: boolean; staff: StaffMember[]; invites: StaffInvite[] }>('/api/staff');
        return { ...res, data: { staff: res.staff ?? [], invites: res.invites ?? [] } } as ApiResponse<{ staff: StaffMember[]; invites: StaffInvite[] }>;
    },
    get: async (uid: string) => {
        const res = await api.get<{ ok: boolean; staff: StaffMember }>(`/api/staff/${uid}`);
        return { ...res, data: { staff: res.staff } } as ApiResponse<{ staff: StaffMember }>;
    },
    invite: async (data: { phoneNumber: string; role?: string }) => {
        const res = await api.post<{ ok: boolean; inviteId: string; code: string }>('/api/staff', data);
        return { ...res, data: { inviteId: res.inviteId, code: res.code } } as ApiResponse<{ inviteId: string; code: string }>;
    },
    update: async (uid: string, data: { role?: 'owner' | 'staff'; ownerId?: string | null }) => {
        const res = await api.patch<{ ok: boolean; id: string }>(`/api/staff/${uid}`, data);
        return { ...res, data: { id: res.id } } as ApiResponse<{ id: string }>;
    },
    delete: (uid: string) =>
        api.delete<ApiOkResponse>(`/api/staff/${uid}`),
    deleteInvite: (id: string) =>
        api.delete<ApiOkResponse>(`/api/staff/invite/${id}`),
};

export const operationsApi = {
    getAccessMatrix: async () => {
        const res = await api.get<{ ok: boolean; matrix: Record<string, unknown> }>('/api/operations/access-matrix');
        return { ...res, data: res.matrix ?? {} } as ApiResponse<Record<string, unknown>>;
    },
    getControls: async () => {
        const res = await api.get<{ ok: boolean; controls: OperationsControls }>('/api/operations/controls');
        return { ...res, data: { controls: res.controls } } as ApiResponse<{ controls: OperationsControls }>;
    },
    updateControls: async (data: Partial<OperationsControls>) => {
        const res = await api.put<{
            ok: boolean;
            controls?: OperationsControls;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>('/api/operations/controls', data);
        return {
            ...res,
            data: {
                controls: res.controls ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ controls: OperationsControls | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    getPeriods: async () => {
        const res = await api.get<{ ok: boolean; periods: FinancialPeriod[] }>('/api/operations/periods');
        return { ...res, data: { periods: res.periods ?? [] } } as ApiResponse<{ periods: FinancialPeriod[] }>;
    },
    lockPeriod: async (data: { periodStart?: string; periodEnd?: string; notes?: string }) => {
        const res = await api.post<{
            ok: boolean;
            id?: string;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>('/api/operations/periods/lock', data);
        return {
            ...res,
            data: {
                id: res.id ?? null,
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ id: string | null; period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    closePeriod: async (id: string) => {
        const res = await api.post<{
            ok: boolean;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>(`/api/operations/periods/${id}/close`, {});
        return {
            ...res,
            data: {
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    reopenPeriod: async (id: string) => {
        const res = await api.post<{
            ok: boolean;
            period?: FinancialPeriod;
            approvalId?: string;
            status?: 'PENDING_APPROVAL';
        }>(`/api/operations/periods/${id}/reopen`, {});
        return {
            ...res,
            data: {
                period: res.period ?? null,
                approvalId: res.approvalId ?? null,
                status: res.status ?? null,
            },
        } as ApiResponse<{ period: FinancialPeriod | null; approvalId: string | null; status: 'PENDING_APPROVAL' | null }>;
    },
    getAuditLogs: async (limit = 50) => {
        const res = await api.get<{ ok: boolean; logs: OperationsAuditLog[] }>('/api/operations/audit-logs', { params: { limit } });
        return { ...res, data: { logs: res.logs ?? [] } } as ApiResponse<{ logs: OperationsAuditLog[] }>;
    },
    getApprovals: async (params?: { status?: OperationApprovalStatus }) => {
        const res = await api.get<{ ok: boolean; approvals: OperationApproval[] }>('/api/operations/approvals', { params });
        return { ...res, data: { approvals: res.approvals ?? [] } } as ApiResponse<{ approvals: OperationApproval[] }>;
    },
    createApproval: async (payload: { actionType: OperationApprovalActionType; module?: string; payload?: Record<string, unknown> }) => {
        const res = await api.post<{ ok: boolean; approvalId: string }>('/api/operations/approvals', payload);
        return { ...res, data: { approvalId: res.approvalId } } as ApiResponse<{ approvalId: string }>;
    },
    approveApproval: async (id: string) => {
        const res = await api.post<{ ok: boolean; approval: OperationApproval }>(`/api/operations/approvals/${id}/approve`, {});
        return { ...res, data: { approval: res.approval } } as ApiResponse<{ approval: OperationApproval }>;
    },
    rejectApproval: async (id: string, note?: string) => {
        const res = await api.post<{ ok: boolean; approval: OperationApproval }>(`/api/operations/approvals/${id}/reject`, { note });
        return { ...res, data: { approval: res.approval } } as ApiResponse<{ approval: OperationApproval }>;
    },
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
    getGstSummary: (params: { month: number; year: number }) =>
        api.get<ApiResponse<{
            rows: {
                gstRate: number;
                taxableTurnover: number;
                cgstAmount: number;
                sgstAmount: number;
                igstAmount: number;
                totalTax: number;
            }[];
        }>>('/api/accounting/gst/summary', { params }),
};

export const accountingApi = {
    getAccounts: (params?: { type?: string }) =>
        api.get<ApiResponse<{
            accounts: {
                id: string;
                code: string;
                name: string;
                type: string;
                parentId: string | null;
                isDefault: boolean;
                isActive: boolean;
                isSystem: boolean;
                createdAt: string;
                updatedAt: string;
                balance: number;
            }[];
        }>>('/api/accounting/accounts', { params }),
    createAccount: (data: { code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'; parentId?: string | null }) =>
        api.post<ApiResponse<{ id: string }>>('/api/accounting/accounts', data),
    updateAccount: (accountId: string, data: { code?: string; name?: string; parentId?: string | null; isActive?: boolean }) =>
        api.patch<ApiOkResponse>(`/api/accounting/accounts/${accountId}`, data),
    deactivateAccount: (accountId: string) =>
        api.post<ApiOkResponse>(`/api/accounting/accounts/${accountId}/deactivate`, {}),
    getTrialBalance: () =>
        api.get<ApiResponse<{
            rows: {
                accountId: string;
                accountName: string;
                accountType: string;
                debitTotal: number;
                creditTotal: number;
            }[];
            totals: { debit: number; credit: number; isBalanced: boolean };
        }>>('/api/accounting/trial-balance'),
    getLedgers: (params?: { includeInactive?: boolean }) =>
        api.get<ApiResponse<{
            data: {
                id: string;
                code: string;
                name: string;
                type: string;
                isSystem: boolean;
                isDefault: boolean;
                isActive: boolean;
                debitTotal: number;
                creditTotal: number;
                balance: number;
            }[];
            totals: { debit: number; credit: number };
        }>>('/api/accounting/ledgers', { params }),
    getLedger: (accountId: string, params?: PaginationParams) =>
        api.get<ApiResponse<{
            account: { id: string; code: string; name: string; type: string };
            currentBalance: number;
            entries: {
                id: string;
                voucherId: string;
                debit: number;
                credit: number;
                voucherType: string;
                voucherNumber: string;
                date: string;
                narration: string | null;
                runningBalance: number;
            }[];
        }>>(`/api/accounting/ledgers/${accountId}`, { params }),
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
    payload: InvoiceCreateInput
): Invoice => {
    const now = nowIso();
    const id = offlineSyncService.createLocalId('inv');
    const items = payload.items ?? [];
    const transactionType = normalizeTransactionType(payload);
    const documentKind = toDocumentKind(payload);
    const tcsAmount = toNumber(payload.tcsAmount, 0);
    const tdsAmount = toNumber(payload.tdsAmount, 0);
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
        + Number(payload.roundOffAmount ?? 0)
        + tcsAmount
        - tdsAmount;
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
        gstRateBreakupJson: {
            transactionType,
            documentKind,
            tcsAmount,
            tdsAmount,
            compositeScheme: Boolean(payload.compositeScheme ?? false),
        },
        eInvoiceIrn: payload.eInvoiceIrn ?? null,
        eInvoiceStatus: payload.eInvoiceStatus ?? null,
        eWayBillNumber: payload.eWayBillNumber ?? null,
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
    payload: Parameters<typeof loanApi.create>[0]
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
        description: payload.notes ?? null,
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
    delete: invoiceApi.delete,
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
        const visible = (response.data ?? []).filter((entry) => !entry.isDeleted);
        await offlineSyncService.setCachedInvoices(visible);
        return { ...response, data: visible };
    } catch (error) {
        const cached = await offlineSyncService.getCachedInvoices();
        const visible = cached.filter((entry) => !entry.isDeleted);
        if (visible.length > 0) {
            return { ok: true, data: visible };
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
        const invoice = cached.find((entry) => entry.id === id && !entry.isDeleted);
        if (invoice) {
            return { ok: true, data: invoice };
        }
        throw error;
    }
};

invoiceApi.create = async (data) => {
    const localInvoice = buildLocalInvoiceFromBuilder(data);
    const syncPayload = mapBuilderToServerCreatePayload(data);
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
            payload: { ...syncPayload, localId: localInvoice.id },
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

invoiceApi.delete = async (id) => {
    await offlineSyncService.archiveCachedInvoice(id);
    try {
        return await originalInvoiceApi.delete(id);
    } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        await offlineSyncService.enqueueMutation({
            type: 'delete_invoice',
            payload: { id },
        });
        return { ok: true, message: 'Invoice delete queued for sync.' };
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
