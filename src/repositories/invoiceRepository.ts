import { api } from '../api/client';
import { offlineSyncService } from '../services/offlineSyncService';
import { getRuntimeBusinessId, getRuntimeBusinessScope } from '../services/runtimeSession';
import { queryClient } from '../state/queryClient';
import { invoiceQueryKeys } from '../state/domainQueryKeys';
import type { ApiListResponse, ApiResponse, PaginationParams } from '../types/api';
import type { Invoice, InvoiceBuilderState } from '../types/domain';

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
    defaultGodownId?: string | null;
};

export type InvoiceListParams = {
    type?: string;
    status?: string;
    from?: string;
    to?: string;
    partyId?: string;
} & PaginationParams;

export type InvoicePaymentInput = {
    paidAmount: number;
    paymentMode: string;
    date?: string;
};

export type PosSaleCreateInput = {
    partyId?: string;
    items: {
        itemId?: string;
        description: string;
        quantity: number;
        rate: number;
        gstRate?: number;
        discountPercent?: number;
        isInterState?: boolean;
        unit?: string;
    }[];
    paymentMode: string;
    paidAmount: number;
    discountAmount?: number;
    roundOffAmount?: number;
    notes?: string;
    placeOfSupply?: string;
};

type ServerTransactionItem = {
    id?: string | null;
    godownId?: string | null;
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
    paymentDate?: string | null;
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

const nowIso = () => new Date().toISOString();

const queueAndAttemptSync = async (
    mutation: Parameters<typeof offlineSyncService.enqueueMutation>[0],
    successMessage: string
) => {
    await offlineSyncService.enqueueMutation(mutation);
    void offlineSyncService.flushQueue();
    return {
        ok: true,
        message: successMessage,
        syncQueued: true,
    };
};

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveInvoicePaymentStatus = (
    totalAmount: number,
    paidAmount: number
): Invoice['paymentStatus'] => {
    if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
    if (paidAmount > 0) return 'PARTIALLY_PAID';
    return 'UNPAID';
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
            godownId: entry.godownId ?? payload.defaultGodownId ?? undefined,
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
    const totalAmount =
        itemsTotal
        + toNumber(payload.additionalCharges)
        - toNumber(payload.discountAmount)
        + toNumber(payload.roundOffAmount);
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
        godownId: payload.defaultGodownId ?? undefined,
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
    const now = nowIso();
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
            godownId: entry.godownId ? String(entry.godownId) : null,
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
        businessId:
            fallback.businessId
            ?? getRuntimeBusinessId()
            ?? 'offline',
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
            defaultGodownId:
                mappedItems.find((item) => item.godownId)?.godownId
                ?? (
                    fallback.gstRateBreakupJson
                    && typeof fallback.gstRateBreakupJson === 'object'
                    && !Array.isArray(fallback.gstRateBreakupJson)
                        ? ((fallback.gstRateBreakupJson as Record<string, unknown>).defaultGodownId ?? null)
                        : null
                ),
            paymentMode: raw.paymentMode ? String(raw.paymentMode).toUpperCase() : undefined,
            paymentDate: raw.paymentDate ? String(raw.paymentDate) : undefined,
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
    const totalTaxableValue = items.reduce((sum, line) => sum + Number(line.taxableValue), 0);
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
        businessId: getRuntimeBusinessId() ?? 'offline',
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
            defaultGodownId: payload.defaultGodownId ?? null,
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
            godownId: line.godownId ?? payload.defaultGodownId ?? null,
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

const filterInvoicesForQuery = (
    invoices: Invoice[],
    params?: InvoiceListParams
) => {
    const requestedType = String(params?.type ?? '').trim().toUpperCase();
    const requestedStatus = String(params?.status ?? '').trim().toUpperCase();
    const requestedPartyId = String(params?.partyId ?? '').trim();
    const from = params?.from?.slice(0, 10);
    const to = params?.to?.slice(0, 10);
    const limit = typeof params?.limit === 'number' ? params.limit : undefined;

    let result = invoices.filter((entry) => !entry.isDeleted);

    if (requestedType) {
        result = result.filter((entry) => {
            const meta = entry.gstRateBreakupJson;
            const documentKind =
                meta && typeof meta === 'object' && !Array.isArray(meta)
                    ? String((meta as Record<string, unknown>).documentKind ?? '').toUpperCase()
                    : '';
            const typeCandidates = [String(entry.invoiceType ?? '').toUpperCase(), documentKind].filter(Boolean);
            return typeCandidates.includes(requestedType);
        });
    }

    if (requestedStatus) {
        result = result.filter((entry) => String(entry.paymentStatus ?? '').toUpperCase() === requestedStatus);
    }

    if (requestedPartyId) {
        result = result.filter((entry) => String(entry.partyId ?? '') === requestedPartyId);
    }

    if (from || to) {
        result = result.filter((entry) => {
            const invoiceDate = String(entry.invoiceDate ?? '').slice(0, 10);
            if (!invoiceDate) return false;
            if (from && invoiceDate < from) return false;
            if (to && invoiceDate > to) return false;
            return true;
        });
    }

    result = [...result].sort((left, right) => String(right.invoiceDate).localeCompare(String(left.invoiceDate)));
    return typeof limit === 'number' ? result.slice(0, limit) : result;
};

const mergeCachedInvoices = async (invoices: Invoice[]) => {
    const current = await offlineSyncService.getCachedInvoices();
    const merged = new Map(current.map((invoice) => [invoice.id, invoice]));
    invoices.forEach((invoice) => {
        merged.set(invoice.id, invoice);
    });
    await offlineSyncService.setCachedInvoices(Array.from(merged.values()));
};

const writeInvoicePaymentQueryCache = async (invoiceId: string) => {
    const cached = await offlineSyncService.getCachedInvoices();
    const invoice = cached.find((entry) => entry.id === invoiceId && !entry.isDeleted);
    if (!invoice) return;
    const businessId = getRuntimeBusinessScope();
    const all = invoiceQueryKeys.all(businessId);

    queryClient.setQueryData(invoiceQueryKeys.detail(businessId, invoiceId), { ok: true, data: invoice });
    queryClient.setQueriesData({ queryKey: all }, (current: ApiListResponse<Invoice> | undefined) => {
        if (!current?.data) return current;
        return {
            ...current,
            data: current.data.map((entry) => (entry.id === invoiceId ? invoice : entry)),
        };
    });
};

const listRemote = async (params?: InvoiceListParams) => {
    const response = await api.get<ServerTransactionListResponse>('/api/transactions', { params });
    return {
        ok: response.ok,
        data: (response.transactions ?? []).map((entry) => mapServerTransactionToInvoice(entry)),
    } as ApiListResponse<Invoice>;
};

const getRemote = async (id: string) => {
    const response = await api.get<ServerTransactionGetResponse>(`/api/transactions/${id}`);
    if (!response.ok || !response.transaction) {
        throw new Error('Transaction not found.');
    }
    return {
        ok: true,
        data: mapServerTransactionToInvoice(response.transaction, { id }),
    } as ApiResponse<Invoice>;
};

export const invoiceRepository = {
    listRemote,
    getRemote,
    list: async (params?: InvoiceListParams) => {
        try {
            const response = await listRemote(params);
            const visible = (response.data ?? []).filter((entry) => !entry.isDeleted);
            await mergeCachedInvoices(visible);
            return { ...response, data: visible };
        } catch (error) {
            const cached = await offlineSyncService.getCachedInvoices();
            const visible = filterInvoicesForQuery(cached, params);
            if (visible.length > 0) {
                return { ok: true, data: visible } as ApiListResponse<Invoice>;
            }
            throw error;
        }
    },
    get: async (id: string) => {
        try {
            const response = await getRemote(id);
            if (response.data) {
                await offlineSyncService.upsertCachedInvoice(response.data);
            }
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedInvoices();
            const invoice = cached.find((entry) => entry.id === id && !entry.isDeleted);
            if (invoice) {
                return { ok: true, data: invoice } as ApiResponse<Invoice>;
            }
            throw error;
        }
    },
    create: async (data: InvoiceCreateInput) => {
        const localInvoice = buildLocalInvoiceFromBuilder(data);
        const syncPayload = mapBuilderToServerCreatePayload(data);
        await offlineSyncService.upsertCachedInvoice(localInvoice);
        await queueAndAttemptSync(
            {
                type: 'create_invoice',
                payload: { ...syncPayload, localId: localInvoice.id },
            },
            'Invoice saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: localInvoice,
            message: 'Invoice saved locally. Sync pending.',
        } as ApiResponse<Invoice>;
    },
    recordPayment: async (invoiceId: string, data: InvoicePaymentInput) => {
        await offlineSyncService.updateCachedInvoicePayment(invoiceId, {
            paidAmount: data.paidAmount,
            paymentMode: data.paymentMode,
            date: data.date,
        });
        await writeInvoicePaymentQueryCache(invoiceId);
        return queueAndAttemptSync(
            {
                type: 'record_invoice_payment',
                payload: {
                    invoiceId,
                    paidAmount: data.paidAmount,
                    paymentMode: data.paymentMode,
                    date: data.date,
                },
            },
            'Payment saved locally. Sync pending.'
        );
    },
    delete: async (id: string) => {
        await offlineSyncService.archiveCachedInvoice(id);
        return queueAndAttemptSync(
            {
                type: 'delete_invoice',
                payload: { id },
            },
            'Invoice delete saved locally. Sync pending.'
        );
    },
    createPosSale: async (payload: PosSaleCreateInput) => {
        const local = buildLocalInvoiceFromBuilder({
            invoiceType: 'POS_BILL',
            invoiceDate: nowIso(),
            partyId: payload.partyId ?? null,
            items: payload.items.map((entry) => ({
                _key: offlineSyncService.createLocalId('line'),
                itemId: entry.itemId ?? null,
                godownId: null,
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
        await queueAndAttemptSync(
            {
                type: 'create_pos_sale',
                payload,
            },
            'POS bill saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: local,
            message: 'POS bill saved locally. Sync pending.',
        } as ApiResponse<Invoice>;
    },
};
