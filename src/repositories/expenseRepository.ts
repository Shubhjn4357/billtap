import { api } from '../api/client';
import { offlineSyncService } from '../services/offlineSyncService';
import type { ApiResponse, DateRangeParams, PaginationParams } from '../types/api';
import type { Expense } from '../types/domain';

type ExpenseListParams = { category?: string } & PaginationParams & DateRangeParams;
type ExpenseCreateInput = Omit<
    Expense,
    'id' | 'businessId' | 'createdByUserId' | 'isDeleted' | 'createdAt' | 'updatedAt'
>;
type ExpenseUpdateInput = Partial<Expense>;

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

const buildLocalExpense = (payload: ExpenseCreateInput): Expense => {
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
        gstRate: payload.gstRate,
        isGstIncluded: payload.isGstIncluded,
    };
};

const buildLocalExpenseRecord = (params: {
    id: string;
    input: Partial<Expense> & { category: Expense['category'] };
    base?: Expense;
}): Expense => {
    const { id, input, base } = params;
    const now = nowIso();
    const expenseDate = input.expenseDate ?? input.date ?? base?.expenseDate ?? base?.date ?? now;
    return {
        id,
        businessId: base?.businessId ?? 'offline',
        category: input.category ?? base?.category ?? 'MISCELLANEOUS',
        accountId: input.accountId ?? base?.accountId ?? null,
        amount: Number(input.amount ?? base?.amount ?? 0),
        gstRate: input.gstRate ?? base?.gstRate,
        isGstIncluded: input.isGstIncluded ?? base?.isGstIncluded,
        date: expenseDate,
        expenseDate,
        description: input.description ?? base?.description ?? null,
        paymentMode: input.paymentMode ?? base?.paymentMode ?? 'CASH',
        partyId: input.partyId ?? base?.partyId ?? null,
        partyName: input.partyName ?? base?.partyName ?? null,
        receiptUrl: input.receiptUrl ?? base?.receiptUrl ?? null,
        createdByUserId: base?.createdByUserId ?? null,
        isDeleted: Boolean(input.isDeleted ?? base?.isDeleted ?? false),
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
    };
};

const toExpenseSyncPayload = (expense: Expense) => ({
    id: expense.id,
    category: expense.category,
    accountId: expense.accountId ?? undefined,
    amount: Number(expense.amount ?? 0),
    gstRate: expense.gstRate,
    isGstIncluded: expense.isGstIncluded,
    date: expense.expenseDate ?? expense.date,
    expenseDate: expense.expenseDate ?? expense.date,
    description: expense.description ?? undefined,
    paymentMode: expense.paymentMode,
    partyId: expense.partyId ?? undefined,
    partyName: expense.partyName ?? undefined,
    receiptUrl: expense.receiptUrl ?? undefined,
});

const mergeCachedExpenses = async (expenses: Expense[]) => {
    const current = await offlineSyncService.getCachedExpenses();
    const merged = new Map(current.map((expense) => [expense.id, expense]));
    expenses.forEach((expense) => {
        merged.set(expense.id, expense);
    });
    await offlineSyncService.setCachedExpenses(Array.from(merged.values()));
};

const filterCachedExpenses = (
    expenses: Expense[],
    params?: ExpenseListParams,
    mode: 'active' | 'recycle-bin' = 'active'
) => {
    const requestedCategory = String(params?.category ?? '').trim().toUpperCase();
    const from = params?.from?.slice(0, 10);
    const to = params?.to?.slice(0, 10);
    const limit = typeof params?.limit === 'number' ? params.limit : undefined;

    let filtered = expenses.filter((expense) =>
        mode === 'recycle-bin' ? expense.isDeleted === true : expense.isDeleted !== true
    );

    if (requestedCategory) {
        filtered = filtered.filter((expense) => String(expense.category ?? '').toUpperCase() === requestedCategory);
    }

    if (from || to) {
        filtered = filtered.filter((expense) => {
            const expenseDate = String(expense.expenseDate ?? expense.date ?? '').slice(0, 10);
            if (!expenseDate) return false;
            if (from && expenseDate < from) return false;
            if (to && expenseDate > to) return false;
            return true;
        });
    }

    filtered = [...filtered].sort((left, right) =>
        String(right.expenseDate ?? right.date ?? right.updatedAt).localeCompare(
            String(left.expenseDate ?? left.date ?? left.updatedAt)
        )
    );

    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
};

const listRemote = async (params?: ExpenseListParams) =>
    api.get<ApiResponse<Expense[]> & { total?: number }>('/api/expenses', { params });

const recycleBinRemote = async (params?: PaginationParams) =>
    api.get<ApiResponse<Expense[]> & { total?: number }>('/api/expenses/recycle-bin', { params });

const getRemote = async (id: string) =>
    api.get<ApiResponse<Expense>>(`/api/expenses/${id}`);

export const expenseRepository = {
    listRemote,
    recycleBinRemote,
    getRemote,
    list: async (params?: ExpenseListParams) => {
        try {
            const response = await listRemote(params);
            await mergeCachedExpenses(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedExpenses();
            const filtered = filterCachedExpenses(cached, params, 'active');
            if (filtered.length > 0) {
                return { ok: true, data: filtered };
            }
            throw error;
        }
    },
    recycleBin: async (params?: PaginationParams) => {
        try {
            const response = await recycleBinRemote(params);
            await mergeCachedExpenses(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedExpenses();
            const archived = filterCachedExpenses(cached, params, 'recycle-bin');
            if (archived.length > 0) {
                return { ok: true, data: archived };
            }
            throw error;
        }
    },
    get: async (id: string) => {
        try {
            const response = await getRemote(id);
            if (response.data) {
                await offlineSyncService.upsertCachedExpense(response.data);
            }
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedExpenses();
            const expense = cached.find((entry) => entry.id === id);
            if (expense) {
                return { ok: true, data: expense };
            }
            throw error;
        }
    },
    create: async (payload: ExpenseCreateInput) => {
        const localExpense = buildLocalExpense(payload);
        await offlineSyncService.upsertCachedExpense(localExpense);
        await queueAndAttemptSync(
            {
                type: 'create_expense',
                payload: { ...payload, id: localExpense.id, localId: localExpense.id },
            },
            'Expense saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: localExpense,
            message: 'Expense saved locally. Sync pending.',
        };
    },
    update: async (id: string, data: ExpenseUpdateInput) => {
        const cached = await offlineSyncService.getCachedExpenses();
        const base = cached.find((entry) => entry.id === id);
        if (!base) {
            return api.put<ApiResponse<Expense>>(`/api/expenses/${id}`, data);
        }

        const localExpense = buildLocalExpenseRecord({
            id,
            input: {
                ...base,
                ...data,
                category: data.category ?? base.category,
            },
            base,
        });
        await offlineSyncService.upsertCachedExpense(localExpense);
        await queueAndAttemptSync(
            {
                type: 'upsert_expense',
                payload: toExpenseSyncPayload(localExpense),
            },
            'Expense updated locally. Sync pending.'
        );
        return {
            ok: true,
            data: localExpense,
            message: 'Expense updated locally. Sync pending.',
        };
    },
    delete: async (id: string) => {
        await offlineSyncService.archiveCachedExpense(id);
        return queueAndAttemptSync(
            {
                type: 'archive_expense',
                payload: { id },
            },
            'Expense archived locally. Sync pending.'
        );
    },
    restore: async (id: string) => {
        await offlineSyncService.restoreCachedExpense(id);
        return queueAndAttemptSync(
            {
                type: 'restore_expense',
                payload: { id },
            },
            'Expense restored locally. Sync pending.'
        );
    },
    permanentDelete: async (id: string) => {
        await offlineSyncService.removeCachedExpense(id);
        return queueAndAttemptSync(
            {
                type: 'permanent_delete_expense',
                payload: { id },
            },
            'Expense removed locally. Sync pending.'
        );
    },
    getByCategorySummary: (params?: DateRangeParams) =>
        api.get<ApiResponse<{ category: string; total: number; count: number }[]>>(
            '/api/expenses/reports/by-category',
            { params }
        ),
};
