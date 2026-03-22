import { api } from '../api/client';
import type { ApiResponse, DateRangeParams, SalesTrendPoint } from '../types/api';
import type { Account, Expense, GodownStockEntry, Invoice, InvoiceItem, Item } from '../types/domain';
import { offlineSyncService } from '../services/offlineSyncService';

export interface OfflineReportSummary {
    totalSales: number;
    totalPurchases: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalTaxCollected: number;
    outstandingReceivables: number;
    outstandingPayables: number;
}

export interface OfflineGstRow {
    gstRate: number;
    taxableTurnover: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
}

export interface BalanceSheetRow {
    accountId: string;
    accountName: string;
    accountType: Account['type'];
    amount: number;
}

export interface BalanceSheetSummary {
    assets: BalanceSheetRow[];
    liabilities: BalanceSheetRow[];
    equity: BalanceSheetRow[];
    totals: {
        assets: number;
        liabilities: number;
        equity: number;
    };
}

type InvoiceTransactionType = 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD' | 'NON_POSTING';
type OfflineQueueMutation = {
    type?: string;
    status?: string;
    createdAt?: string;
    payload?: Record<string, unknown>;
};

const NON_POSTING_DOC_KINDS = new Set([
    'ESTIMATE',
    'PROFORMA',
    'SALE_ORDER',
    'PURCHASE_ORDER',
    'DELIVERY_CHALLAN_DOC',
]);

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const readInvoiceMeta = (invoice: Invoice): Record<string, unknown> => {
    const raw = invoice.gstRateBreakupJson;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }
    return raw as Record<string, unknown>;
};

const resolveInvoiceTransactionType = (invoice: Invoice): InvoiceTransactionType => {
    const meta = readInvoiceMeta(invoice);
    const explicit = String(meta.transactionType ?? '').toUpperCase();
    if (
        explicit === 'SALE'
        || explicit === 'PURCHASE'
        || explicit === 'RETURN_INWARD'
        || explicit === 'RETURN_OUTWARD'
    ) {
        return explicit;
    }

    const billMode = String(meta.billMode ?? '').toUpperCase();
    const documentKind = String(meta.documentKind ?? invoice.invoiceType ?? '').toUpperCase();
    if (billMode === 'ESTIMATE' || NON_POSTING_DOC_KINDS.has(documentKind)) {
        return 'NON_POSTING';
    }
    if (documentKind === 'PURCHASE_BILL' || documentKind === 'PURCHASE_ORDER') return 'PURCHASE';
    if (documentKind === 'DEBIT_NOTE_DOC' || documentKind === 'PURCHASE_RETURN') return 'RETURN_INWARD';
    if (documentKind === 'CREDIT_NOTE_DOC' || documentKind === 'SALE_RETURN') return 'RETURN_OUTWARD';
    if (invoice.invoiceType === 'ESTIMATE' || invoice.invoiceType === 'PROFORMA') return 'NON_POSTING';
    return 'SALE';
};

const isWithinDateRange = (value: string | null | undefined, from?: string, to?: string) => {
    const normalized = String(value ?? '').slice(0, 10);
    if (!normalized) return false;
    if (from && normalized < from) return false;
    if (to && normalized > to) return false;
    return true;
};

const isWithinMonth = (value: string | null | undefined, month: number, year: number) => {
    const normalized = String(value ?? '').slice(0, 7);
    const expected = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    return normalized === expected;
};

const getPostingSign = (type: InvoiceTransactionType) => {
    if (type === 'SALE') return 1;
    if (type === 'PURCHASE') return 1;
    if (type === 'RETURN_INWARD' || type === 'RETURN_OUTWARD') return -1;
    return 0;
};

const toPositiveNumber = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const filterPostingInvoices = (invoices: Invoice[], from?: string, to?: string) =>
    invoices.filter((invoice) =>
        !invoice.isDeleted
        && isWithinDateRange(invoice.invoiceDate, from, to)
        && resolveInvoiceTransactionType(invoice) !== 'NON_POSTING'
    );

const buildSignedItemAggregate = (line: InvoiceItem, sign: number) => ({
    gstRate: toPositiveNumber(line.gstRate),
    taxableTurnover: roundCurrency(toPositiveNumber(line.taxableValue) * sign),
    cgstAmount: roundCurrency(toPositiveNumber(line.cgstAmount) * sign),
    sgstAmount: roundCurrency(toPositiveNumber(line.sgstAmount) * sign),
    igstAmount: roundCurrency(toPositiveNumber(line.igstAmount) * sign),
    totalTax: roundCurrency(
        (toPositiveNumber(line.cgstAmount) + toPositiveNumber(line.sgstAmount) + toPositiveNumber(line.igstAmount)) * sign
    ),
});

export const buildOfflineReportSummaryFromRecords = (
    invoices: Invoice[],
    expenses: Expense[],
    params?: DateRangeParams
): OfflineReportSummary => {
    const postingInvoices = filterPostingInvoices(invoices, params?.from, params?.to);
    const periodExpenses = expenses.filter((expense) =>
        !expense.isDeleted && isWithinDateRange(expense.expenseDate || expense.date, params?.from, params?.to)
    );

    let totalSales = 0;
    let totalPurchases = 0;
    let totalTaxCollected = 0;
    let outstandingReceivables = 0;
    let outstandingPayables = 0;

    for (const invoice of postingInvoices) {
        const transactionType = resolveInvoiceTransactionType(invoice);
        const invoiceTotal = toPositiveNumber(invoice.totalInvoiceValue);
        const openAmount = Math.max(invoiceTotal - toPositiveNumber(invoice.paidAmount), 0);

        if (transactionType === 'SALE') {
            totalSales += invoiceTotal;
            totalTaxCollected += toPositiveNumber(invoice.totalTaxAmount);
            outstandingReceivables += openAmount;
            continue;
        }

        if (transactionType === 'RETURN_OUTWARD') {
            totalSales -= invoiceTotal;
            totalTaxCollected -= toPositiveNumber(invoice.totalTaxAmount);
            outstandingReceivables -= openAmount;
            continue;
        }

        if (transactionType === 'PURCHASE') {
            totalPurchases += invoiceTotal;
            outstandingPayables += openAmount;
            continue;
        }

        if (transactionType === 'RETURN_INWARD') {
            totalPurchases -= invoiceTotal;
            outstandingPayables -= openAmount;
        }
    }

    const totalExpenses = periodExpenses.reduce((sum, expense) => sum + toPositiveNumber(expense.amount), 0);
    const grossProfit = totalSales - totalPurchases;
    const netProfit = grossProfit - totalExpenses;

    return {
        totalSales: roundCurrency(totalSales),
        totalPurchases: roundCurrency(totalPurchases),
        grossProfit: roundCurrency(grossProfit),
        totalExpenses: roundCurrency(totalExpenses),
        netProfit: roundCurrency(netProfit),
        totalTaxCollected: roundCurrency(totalTaxCollected),
        outstandingReceivables: roundCurrency(Math.max(outstandingReceivables, 0)),
        outstandingPayables: roundCurrency(Math.max(outstandingPayables, 0)),
    };
};

export const buildOfflineGstRowsFromInvoices = (
    invoices: Invoice[],
    params: { month: number; year: number }
): OfflineGstRow[] => {
    const rows = new Map<number, OfflineGstRow>();

    for (const invoice of invoices) {
        if (invoice.isDeleted || !isWithinMonth(invoice.invoiceDate, params.month, params.year)) {
            continue;
        }

        const transactionType = resolveInvoiceTransactionType(invoice);
        if (transactionType !== 'SALE' && transactionType !== 'RETURN_OUTWARD') {
            continue;
        }

        const sign = getPostingSign(transactionType);
        const items = Array.isArray(invoice.items) ? invoice.items : [];
        for (const line of items) {
            const gstRate = toPositiveNumber(line.gstRate);
            const current = rows.get(gstRate) ?? {
                gstRate,
                taxableTurnover: 0,
                cgstAmount: 0,
                sgstAmount: 0,
                igstAmount: 0,
                totalTax: 0,
            };
            const aggregate = buildSignedItemAggregate(line, sign);
            rows.set(gstRate, {
                gstRate,
                taxableTurnover: roundCurrency(current.taxableTurnover + aggregate.taxableTurnover),
                cgstAmount: roundCurrency(current.cgstAmount + aggregate.cgstAmount),
                sgstAmount: roundCurrency(current.sgstAmount + aggregate.sgstAmount),
                igstAmount: roundCurrency(current.igstAmount + aggregate.igstAmount),
                totalTax: roundCurrency(current.totalTax + aggregate.totalTax),
            });
        }
    }

    return Array.from(rows.values())
        .filter((row) =>
            row.taxableTurnover !== 0
            || row.cgstAmount !== 0
            || row.sgstAmount !== 0
            || row.igstAmount !== 0
            || row.totalTax !== 0
        )
        .sort((left, right) => left.gstRate - right.gstRate);
};

export const buildOfflineGodownStockFromRecords = (
    godownId: string,
    invoices: Invoice[],
    items: Item[]
): GodownStockEntry[] => {
    const rows = new Map<string, GodownStockEntry>();
    const itemById = new Map(items.map((item) => [item.id, item]));

    for (const invoice of invoices) {
        if (invoice.isDeleted) continue;
        const transactionType = resolveInvoiceTransactionType(invoice);
        if (transactionType === 'NON_POSTING') continue;

        const sign = transactionType === 'PURCHASE' || transactionType === 'RETURN_INWARD' ? 1 : -1;
        const lines = Array.isArray(invoice.items) ? invoice.items : [];
        for (const line of lines) {
            if (!line.godownId || line.godownId !== godownId) continue;
            const key = line.itemId ?? line.description;
            const fallbackItem = line.itemId ? itemById.get(line.itemId) : undefined;
            const current = rows.get(key) ?? {
                itemId: line.itemId ?? key,
                quantity: 0,
                itemName: fallbackItem?.name ?? line.description ?? null,
                itemSku: fallbackItem?.sku ?? null,
                itemUnit: fallbackItem?.unit ?? line.unit ?? null,
            };
            rows.set(key, {
                ...current,
                quantity: roundCurrency(current.quantity + (toPositiveNumber(line.quantity) * sign)),
            });
        }
    }

    return Array.from(rows.values())
        .filter((row) => row.quantity !== 0)
        .sort((left, right) => String(left.itemName ?? left.itemId).localeCompare(String(right.itemName ?? right.itemId)));
};

const createOfflineGodownEntry = (
    itemId: string,
    itemById: Map<string, Item>,
    payload?: Record<string, unknown>
): GodownStockEntry => {
    const item = itemById.get(itemId);
    return {
        itemId,
        quantity: 0,
        itemName:
            item?.name
            ?? (typeof payload?.name === 'string' ? payload.name : null),
        itemSku: item?.sku ?? null,
        itemUnit:
            item?.unit
            ?? (typeof payload?.unit === 'string' ? payload.unit : null),
    };
};

const applyQueuedGodownStockMutations = (
    godownId: string,
    baseRows: GodownStockEntry[],
    items: Item[],
    queue: OfflineQueueMutation[]
): GodownStockEntry[] => {
    const rows = new Map(baseRows.map((row) => [row.itemId, { ...row }]));
    const itemById = new Map(items.map((item) => [item.id, item]));

    for (const mutation of queue.sort((left, right) =>
        String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? ''))
    )) {
        if (!mutation || mutation.status === 'conflict_manual') continue;
        const payload = mutation.payload ?? {};

        if (mutation.type === 'upsert_item') {
            if (payload.godownId !== godownId || typeof payload.id !== 'string') continue;
            const quantity = Number(payload.stock ?? payload.openingStock ?? 0);
            if (!Number.isFinite(quantity)) continue;
            if (quantity === 0) {
                rows.delete(payload.id);
                continue;
            }
            rows.set(payload.id, {
                ...(rows.get(payload.id) ?? createOfflineGodownEntry(payload.id, itemById, payload)),
                quantity: roundCurrency(quantity),
            });
            continue;
        }

        if (mutation.type === 'adjust_item_stock') {
            if (payload.godownId !== godownId || typeof payload.id !== 'string') continue;
            const quantity = Number(payload.quantity ?? 0);
            if (!Number.isFinite(quantity) || quantity < 0) continue;
            const current = rows.get(payload.id) ?? createOfflineGodownEntry(payload.id, itemById);
            const nextQuantity =
                payload.type === 'IN'
                    ? current.quantity + quantity
                    : payload.type === 'OUT'
                        ? current.quantity - quantity
                        : quantity;
            if (nextQuantity <= 0) {
                rows.delete(payload.id);
                continue;
            }
            rows.set(payload.id, {
                ...current,
                quantity: roundCurrency(nextQuantity),
            });
            continue;
        }

        if (mutation.type === 'transfer_godown_stock') {
            if (typeof payload.itemId !== 'string') continue;
            const quantity = Number(payload.quantity ?? 0);
            if (!Number.isFinite(quantity) || quantity <= 0) continue;
            const itemId = payload.itemId;

            if (payload.fromGodownId === godownId) {
                const current = rows.get(itemId) ?? createOfflineGodownEntry(itemId, itemById);
                const nextQuantity = roundCurrency(current.quantity - quantity);
                if (nextQuantity <= 0) {
                    rows.delete(itemId);
                } else {
                    rows.set(itemId, {
                        ...current,
                        quantity: nextQuantity,
                    });
                }
            }

            if (payload.toGodownId === godownId) {
                const current = rows.get(itemId) ?? createOfflineGodownEntry(itemId, itemById);
                rows.set(itemId, {
                    ...current,
                    quantity: roundCurrency(current.quantity + quantity),
                });
            }
        }
    }

    return Array.from(rows.values())
        .filter((row) => row.quantity !== 0)
        .sort((left, right) => String(left.itemName ?? left.itemId).localeCompare(String(right.itemName ?? right.itemId)));
};

export const buildOfflineReportSummary = async (
    params?: DateRangeParams
): Promise<ApiResponse<OfflineReportSummary>> => {
    const [invoices, expenses] = await Promise.all([
        offlineSyncService.getCachedInvoices(),
        offlineSyncService.getCachedExpenses(),
    ]);

    return {
        ok: true,
        data: buildOfflineReportSummaryFromRecords(invoices, expenses, params),
        message: 'Loaded from offline data.',
    };
};

export const buildOfflineGstSummary = async (
    params: { month: number; year: number }
): Promise<ApiResponse<{ rows: OfflineGstRow[] }>> => {
    const invoices = await offlineSyncService.getCachedInvoices();
    return {
        ok: true,
        data: {
            rows: buildOfflineGstRowsFromInvoices(invoices, params),
        },
        message: 'Loaded from offline data.',
    };
};

export const buildOfflineGodownStock = async (
    godownId: string
): Promise<ApiResponse<GodownStockEntry[]>> => {
    const [invoices, items, queue] = await Promise.all([
        offlineSyncService.getCachedInvoices(),
        offlineSyncService.getCachedItems(),
        offlineSyncService.getQueue(),
    ]);

    return {
        ok: true,
        data: applyQueuedGodownStockMutations(
            godownId,
            buildOfflineGodownStockFromRecords(godownId, invoices, items),
            items,
            queue as OfflineQueueMutation[]
        ),
        message: 'Loaded from offline data.',
    };
};

export const buildOfflineBalanceSheetFromAccounts = (accounts: Account[]): BalanceSheetSummary => {
    const assets = accounts
        .filter((entry) => entry.isActive !== false && entry.type === 'ASSET')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
            amount: Number(entry.balance ?? 0),
        }));

    const liabilities = accounts
        .filter((entry) => entry.isActive !== false && entry.type === 'LIABILITY')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
            amount: Math.abs(Number(entry.balance ?? 0)),
        }));

    const equity = accounts
        .filter((entry) => entry.isActive !== false && entry.type === 'EQUITY')
        .map((entry) => ({
            accountId: entry.id,
            accountName: entry.name,
            accountType: entry.type,
            amount: Math.abs(Number(entry.balance ?? 0)),
        }));

    return {
        assets,
        liabilities,
        equity,
        totals: {
            assets: assets.reduce((sum, row) => sum + row.amount, 0),
            liabilities: liabilities.reduce((sum, row) => sum + row.amount, 0),
            equity: equity.reduce((sum, row) => sum + row.amount, 0),
        },
    };
};

const toTrendBucketKey = (date: Date, granularity: 'daily' | 'weekly' | 'monthly') => {
    if (granularity === 'monthly') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (granularity === 'weekly') {
        const start = new Date(date);
        const weekday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - weekday);
        return start.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
};

export const buildOfflineSalesTrend = async (
    params?: DateRangeParams & { granularity?: 'daily' | 'weekly' | 'monthly' }
): Promise<ApiResponse<SalesTrendPoint[]>> => {
    const granularity = params?.granularity ?? 'daily';
    const buckets = new Map<string, SalesTrendPoint>();
    const invoices = await offlineSyncService.getCachedInvoices();

    for (const invoice of invoices) {
        if (invoice.isDeleted || !isWithinDateRange(invoice.invoiceDate, params?.from, params?.to)) {
            continue;
        }

        const transactionType = resolveInvoiceTransactionType(invoice);
        if (transactionType !== 'SALE' && transactionType !== 'RETURN_OUTWARD') {
            continue;
        }

        const date = new Date(invoice.invoiceDate);
        if (Number.isNaN(date.getTime())) continue;

        const key = toTrendBucketKey(date, granularity);
        const sign = transactionType === 'RETURN_OUTWARD' ? -1 : 1;
        const current = buckets.get(key) ?? { date: key, amount: 0, count: 0 };
        buckets.set(key, {
            date: key,
            amount: roundCurrency(current.amount + (toPositiveNumber(invoice.totalInvoiceValue) * sign)),
            count: Math.max(current.count + sign, 0),
        });
    }

    return {
        ok: true,
        data: Array.from(buckets.values()).sort((left, right) => left.date.localeCompare(right.date)),
        message: 'Loaded from offline data.',
    };
};

type ReportSummaryResponse = ApiResponse<{
    totalSales: number;
    totalPurchases: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalTaxCollected: number;
    outstandingReceivables: number;
    outstandingPayables: number;
}>;

type GstRowsResponse = ApiResponse<{
    rows: {
        gstRate: number;
        taxableTurnover: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        totalTax: number;
    }[];
}>;

type BalanceSheetResponse = ApiResponse<BalanceSheetSummary>;

const getRemoteSummary = async (params?: DateRangeParams): Promise<ReportSummaryResponse> => {
    const res = await api.get<{
        ok: boolean;
        income?: { account: string; amount: number }[];
        expenses?: { account: string; amount: number }[];
        totalIncome?: number;
        totalExpenses?: number;
        netProfit?: number;
        message?: string;
    }>('/api/reporting/pnl', { params });

    const totalSales = Number(res.totalIncome ?? 0);
    const totalExpenses = Number(res.totalExpenses ?? 0);
    const netProfit = Number(res.netProfit ?? (totalSales - totalExpenses));

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
};

const getRemoteGstRows = async (
    params: { month: number; year: number }
): Promise<GstRowsResponse> => {
    const res = await api.get<{
        ok: boolean;
        rows?: {
            gstRate: number;
            taxableTurnover: number;
            cgstAmount: number;
            sgstAmount: number;
            igstAmount: number;
            totalTax: number;
        }[];
        message?: string;
    }>('/api/accounting/gst/summary', { params });

    return {
        ...res,
        data: {
            rows: res.rows ?? [],
        },
    };
};

const getRemoteBalanceSheet = async (): Promise<BalanceSheetResponse> => {
    const res = await api.get<{
        ok: boolean;
        assets?: BalanceSheetRow[];
        liabilities?: BalanceSheetRow[];
        equity?: BalanceSheetRow[];
        totals?: BalanceSheetSummary['totals'];
        message?: string;
    }>('/api/reporting/balance-sheet');

    return {
        ...res,
        data: {
            assets: res.assets ?? [],
            liabilities: res.liabilities ?? [],
            equity: res.equity ?? [],
            totals: res.totals ?? { assets: 0, liabilities: 0, equity: 0 },
        },
    };
};

export const reportRepository = {
    getSummary: async (params?: DateRangeParams): Promise<ReportSummaryResponse> => {
        const offline = await buildOfflineReportSummary(params);
        try {
            const response = await getRemoteSummary(params);
            return {
                ...response,
                data: {
                    ...offline.data,
                    ...response.data,
                    totalPurchases: offline.data.totalPurchases,
                    totalTaxCollected: offline.data.totalTaxCollected,
                    outstandingReceivables: offline.data.outstandingReceivables,
                    outstandingPayables: offline.data.outstandingPayables,
                },
                message: response.message ?? offline.message,
            };
        } catch (error) {
            if (offline.data) {
                return offline;
            }
            throw error;
        }
    },

    getSalesTrend: async (
        params?: DateRangeParams & { granularity?: 'daily' | 'weekly' | 'monthly' }
    ): Promise<ApiResponse<SalesTrendPoint[]>> => {
        const offline = await buildOfflineSalesTrend(params);
        try {
            const res = await api.get<{ ok: boolean; transactions?: SalesTrendPoint[]; message?: string }>('/api/reporting/export/transactions', {
                params,
            });
            return {
                ok: res.ok,
                data: Array.isArray(res.transactions) && res.transactions.length > 0 ? res.transactions : offline.data,
                message: res.message ?? offline.message,
            };
        } catch (error) {
            if (offline.data.length > 0) {
                return offline;
            }
            throw error;
        }
    },

    getGstSummary: async (params: { month: number; year: number }): Promise<GstRowsResponse> => {
        try {
            return await getRemoteGstRows(params);
        } catch (error) {
            const offline = await buildOfflineGstSummary(params);
            if (offline.data) {
                return offline;
            }
            throw error;
        }
    },

    getGstr1: async (params: { month: number; year: number }): Promise<GstRowsResponse> => {
        try {
            return await getRemoteGstRows(params);
        } catch (error) {
            const offline = await buildOfflineGstSummary(params);
            if (offline.data) {
                return offline;
            }
            throw error;
        }
    },

    getGstr3b: async (params: { month: number; year: number }): Promise<GstRowsResponse> => {
        try {
            return await getRemoteGstRows(params);
        } catch (error) {
            const offline = await buildOfflineGstSummary(params);
            if (offline.data) {
                return offline;
            }
            throw error;
        }
    },

    getBalanceSheet: async (): Promise<BalanceSheetResponse> => {
        try {
            return await getRemoteBalanceSheet();
        } catch (error) {
            const accounts = await offlineSyncService.getCachedAccountingAccounts();
            if (accounts.length > 0) {
                return {
                    ok: true,
                    data: buildOfflineBalanceSheetFromAccounts(accounts),
                    message: 'Loaded from offline data.',
                };
            }
            throw error;
        }
    },
};
