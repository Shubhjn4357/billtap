import { api, isCloudWriteBlockedError, toApiError } from '../api/client';
import { queryClient } from '../state/queryClient';
import { cashBankQueryKeys } from '../state/domainQueryKeys';
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';
import { getRuntimeBusinessId, getRuntimeBusinessScope } from '../services/runtimeSession';
import { isOnline } from '../utils/network';
import type { ApiOkResponse, ApiResponse, PaginationParams } from '../types/api';
import type { Account } from '../types/domain';

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

const shouldKeepLocalWriteOnError = (error: unknown) =>
    isOfflineLikeError(error) || isCloudWriteBlockedError(error);

const buildLocalAccountingAccount = (params: {
    id: string;
    input: {
        code: string;
        name: string;
        type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
        parentId?: string | null;
        isActive?: boolean;
    };
    base?: Account | null;
}): Account => {
    const { id, input, base } = params;
    return {
        id,
        businessId: base?.businessId ?? (getRuntimeBusinessId() ?? 'offline'),
        name: input.name,
        code: input.code,
        type: input.type,
        parentAccountId: input.parentId ?? base?.parentAccountId ?? null,
        isDefault: Boolean(base?.isDefault ?? false),
        isSystem: Boolean(base?.isSystem ?? false),
        isActive: Boolean(input.isActive ?? base?.isActive ?? true),
        balance: Number(base?.balance ?? 0),
    };
};

const filterCachedAccounts = (
    accounts: Account[],
    params?: { type?: string; includeInactive?: boolean }
) => {
    const requestedType = String(params?.type ?? '').trim().toUpperCase();
    const includeInactive = params?.includeInactive ?? false;
    return accounts.filter((account) => {
        if (!includeInactive && account.isActive === false) return false;
        if (requestedType && String(account.type).toUpperCase() !== requestedType) return false;
        return true;
    });
};

const buildOfflineLedgerRows = (accounts: Account[]) => {
    const rows = accounts
        .filter((entry) => entry.isActive !== false)
        .map((entry) => {
            const balance = Number(entry.balance ?? 0);
            return {
                id: entry.id,
                code: entry.code,
                name: entry.name,
                type: entry.type,
                isSystem: Boolean(entry.isSystem),
                isDefault: Boolean(entry.isDefault),
                isActive: Boolean(entry.isActive),
                debitTotal: balance >= 0 ? balance : 0,
                creditTotal: balance < 0 ? Math.abs(balance) : 0,
                balance,
            };
        });
    return {
        rows,
        totals: {
            debit: rows.reduce((sum, entry) => sum + entry.debitTotal, 0),
            credit: rows.reduce((sum, entry) => sum + entry.creditTotal, 0),
        },
    };
};

const buildOfflineTrialBalance = (accounts: Account[]) => {
    const rows = accounts
        .filter((entry) => entry.isActive !== false)
        .map((entry) => {
            const balance = Number(entry.balance ?? 0);
            return {
                accountId: entry.id,
                accountName: entry.name,
                accountType: entry.type,
                debitTotal: balance >= 0 ? balance : 0,
                creditTotal: balance < 0 ? Math.abs(balance) : 0,
            };
        });
    const debit = rows.reduce((sum, entry) => sum + entry.debitTotal, 0);
    const credit = rows.reduce((sum, entry) => sum + entry.creditTotal, 0);
    return {
        rows,
        totals: {
            debit,
            credit,
            isBalanced: Math.abs(debit - credit) < 0.0001,
        },
    };
};

const writeCashBankBalancesQueryCache = (accounts: Account[]) => {
    const businessId = getRuntimeBusinessScope();
    queryClient.setQueryData(cashBankQueryKeys.balances(businessId), { ok: true, data: accounts });
    queryClient.setQueryData(
        cashBankQueryKeys.summary(businessId),
        (
            current:
                | ApiResponse<{ accounts: Account[]; recentVouchers: unknown[]; totalBalance: number }>
                | undefined
        ) => {
            if (!current?.data) return current;
            return {
                ...current,
                data: {
                    ...current.data,
                    accounts,
                    totalBalance: accounts.reduce((sum, entry) => sum + Number(entry.balance ?? 0), 0),
                },
            };
        }
    );
};

const syncCashBankAccountsFromAccounting = async (accounts: Account[]) => {
    const currentCashBank = await offlineSyncService.getCachedCashBankAccounts();
    const balanceById = new Map(currentCashBank.map((entry) => [entry.id, Number(entry.balance ?? 0)]));
    const nextCashBank = accounts
        .filter((entry) => entry.type === 'ASSET' && entry.isActive !== false)
        .map((entry) => ({
            ...entry,
            balance: balanceById.get(entry.id) ?? Number(entry.balance ?? 0),
        }));
    await offlineSyncService.setCachedCashBankAccounts(nextCashBank);
    writeCashBankBalancesQueryCache(nextCashBank);
};

const applyCashBankBalancesToAccountingAccounts = async (accounts: Account[]) => {
    const currentCashBank = await offlineSyncService.getCachedCashBankAccounts();
    const balanceById = new Map(currentCashBank.map((entry) => [entry.id, Number(entry.balance ?? 0)]));
    return accounts.map((entry) => ({
        ...entry,
        balance: balanceById.get(entry.id) ?? Number(entry.balance ?? 0),
    }));
};

const queueHasMutation = async (predicate: (entry: { type?: string; payload?: Record<string, unknown> }) => boolean) => {
    const queue = await offlineSyncService.getQueue();
    return queue.some((entry) => predicate(entry as { type?: string; payload?: Record<string, unknown> }));
};

const hasPendingAccountingAccountCreate = async (id: string) =>
    queueHasMutation((entry) => entry.type === 'create_accounting_account' && entry.payload?.id === id);

export const accountingRepository = {
    getAccountsRemote: async (params?: { type?: string }) => {
        const res = await api.get<{
            ok: boolean;
            accounts?: {
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
        }>('/api/accounting/accounts', { params });
        return {
            ...res,
            data: {
                accounts: res.accounts ?? [],
            },
        } as ApiResponse<{
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
        }>;
    },
    createAccountRemote: async (data: { id?: string; code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'; parentId?: string | null }) => {
        const res = await api.post<{ ok: boolean; id?: string }>('/api/accounting/accounts', data);
        return { ...res, data: { id: String(res.id ?? '') } } as ApiResponse<{ id: string }>;
    },
    updateAccountRemote: (accountId: string, data: { code?: string; name?: string; parentId?: string | null; isActive?: boolean }) =>
        api.patch<ApiOkResponse>(`/api/accounting/accounts/${accountId}`, data),
    deactivateAccountRemote: (accountId: string) =>
        api.post<ApiOkResponse>(`/api/accounting/accounts/${accountId}/deactivate`, {}),
    getTrialBalanceRemote: async () => {
        const res = await api.get<{
            ok: boolean;
            rows?: {
                accountId: string;
                accountName: string;
                accountType: string;
                debitTotal: number;
                creditTotal: number;
            }[];
            totals?: { debit: number; credit: number; isBalanced: boolean };
        }>('/api/accounting/trial-balance');
        return {
            ...res,
            data: {
                rows: res.rows ?? [],
                totals: res.totals ?? { debit: 0, credit: 0, isBalanced: true },
            },
        } as ApiResponse<{
            rows: {
                accountId: string;
                accountName: string;
                accountType: string;
                debitTotal: number;
                creditTotal: number;
            }[];
            totals: { debit: number; credit: number; isBalanced: boolean };
        }>;
    },
    getLedgersRemote: async (params?: { includeInactive?: boolean }) => {
        const res = await api.get<{
            ok: boolean;
            data?: {
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
            totals?: { debit: number; credit: number };
        }>('/api/accounting/ledgers', { params });
        return {
            ...res,
            data: {
                data: res.data ?? [],
                totals: res.totals ?? { debit: 0, credit: 0 },
            },
        } as ApiResponse<{
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
        }>;
    },
    getLedgerRemote: (accountId: string, params?: PaginationParams) =>
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
    getAccounts: async (params?: { type?: string; includeInactive?: boolean }) => {
        try {
            const response = await accountingRepository.getAccountsRemote(params);
            const accounts = await applyCashBankBalancesToAccountingAccounts((response.data?.accounts ?? []).map((entry) => ({
                id: entry.id,
                businessId: getRuntimeBusinessId() ?? 'offline',
                name: entry.name,
                code: entry.code,
                type: entry.type as Account['type'],
                parentAccountId: entry.parentId,
                isDefault: Boolean(entry.isDefault),
                isSystem: Boolean(entry.isSystem),
                isActive: Boolean(entry.isActive),
                balance: Number(entry.balance ?? 0),
            })) as Account[]);
            await offlineSyncService.setCachedAccountingAccounts(accounts);
            return {
                ...response,
                data: {
                    accounts: filterCachedAccounts(accounts, params).map((entry) => ({
                        id: entry.id,
                        code: entry.code,
                        name: entry.name,
                        type: entry.type,
                        parentId: entry.parentAccountId,
                        isDefault: entry.isDefault,
                        isActive: entry.isActive,
                        isSystem: entry.isSystem,
                        createdAt: nowIso(),
                        updatedAt: nowIso(),
                        balance: Number(entry.balance ?? 0),
                    })),
                },
            };
        } catch {
            const cached = await offlineSyncService.getCachedAccountingAccounts();
            return {
                ok: true,
                data: {
                    accounts: filterCachedAccounts(cached, params).map((entry) => ({
                        id: entry.id,
                        code: entry.code,
                        name: entry.name,
                        type: entry.type,
                        parentId: entry.parentAccountId,
                        isDefault: entry.isDefault,
                        isActive: entry.isActive,
                        isSystem: entry.isSystem,
                        createdAt: nowIso(),
                        updatedAt: nowIso(),
                        balance: Number(entry.balance ?? 0),
                    })),
                },
            } as ApiResponse<{
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
            }>;
        }
    },
    createAccount: async (data: { id?: string; code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'; parentId?: string | null }) => {
        const previousAccounts = await offlineSyncService.getCachedAccountingAccounts();
        const localAccount = buildLocalAccountingAccount({
            id: data.id ?? offlineSyncService.createLocalId('account'),
            input: data,
        });
        const nextAccounts = [localAccount, ...previousAccounts.filter((entry) => entry.id !== localAccount.id)];
        await offlineSyncService.setCachedAccountingAccounts(nextAccounts);
        await syncCashBankAccountsFromAccounting(nextAccounts);
        let syncMessage = 'Account saved locally. Sync pending.';

        if (await isOnline()) {
            try {
                const response = await accountingRepository.createAccountRemote({ ...data, id: localAccount.id });
                return { ...response, data: { id: response.data?.id || localAccount.id } };
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[accounting] create account failed', { payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedAccountingAccounts(previousAccounts);
                    await syncCashBankAccountsFromAccounting(previousAccounts);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Account saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[accounting] keeping local account create after cloud rejection', { payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            {
                type: 'create_accounting_account',
                payload: {
                    id: localAccount.id,
                    code: localAccount.code,
                    name: localAccount.name,
                    type: localAccount.type,
                    ...(localAccount.parentAccountId !== null ? { parentId: localAccount.parentAccountId } : {}),
                },
            },
            syncMessage
        );
        return {
            ok: true,
            data: { id: localAccount.id },
            message: syncMessage,
        } as ApiResponse<{ id: string }>;
    },
    updateAccount: async (accountId: string, data: { code?: string; name?: string; parentId?: string | null; isActive?: boolean }) => {
        const previousAccounts = await offlineSyncService.getCachedAccountingAccounts();
        const existing = previousAccounts.find((entry) => entry.id === accountId);
        if (!existing) {
            return accountingRepository.updateAccountRemote(accountId, data);
        }

        const nextAccount = buildLocalAccountingAccount({
            id: accountId,
            input: {
                code: data.code ?? existing.code,
                name: data.name ?? existing.name,
                type: existing.type,
                parentId: data.parentId ?? existing.parentAccountId,
                isActive: data.isActive ?? existing.isActive,
            },
            base: existing,
        });
        const nextAccounts = previousAccounts.map((entry) => (entry.id === accountId ? nextAccount : entry));
        await offlineSyncService.setCachedAccountingAccounts(nextAccounts);
        await syncCashBankAccountsFromAccounting(nextAccounts);
        let syncMessage = 'Account update saved locally. Sync pending.';

        const shouldCallOnline = await isOnline() && !(await hasPendingAccountingAccountCreate(accountId));
        if (shouldCallOnline) {
            try {
                return await accountingRepository.updateAccountRemote(accountId, data);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[accounting] update account failed', { accountId, payload: data, error: toApiError(error) });
                    await offlineSyncService.setCachedAccountingAccounts(previousAccounts);
                    await syncCashBankAccountsFromAccounting(previousAccounts);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Account update saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[accounting] keeping local account update after cloud rejection', { accountId, payload: data, error: toApiError(error) });
            }
        }

        await queueAndAttemptSync(
            { type: 'update_accounting_account', payload: { id: accountId, ...data } },
            syncMessage
        );
        return { ok: true, message: syncMessage } as ApiOkResponse;
    },
    deactivateAccount: async (accountId: string) => {
        const previousAccounts = await offlineSyncService.getCachedAccountingAccounts();
        const nextAccounts = previousAccounts.map((entry) =>
            entry.id === accountId ? { ...entry, isActive: false } : entry
        );
        await offlineSyncService.setCachedAccountingAccounts(nextAccounts);
        await syncCashBankAccountsFromAccounting(nextAccounts);
        let syncMessage = 'Account deactivation saved locally. Sync pending.';

        const shouldCallOnline = await isOnline() && !(await hasPendingAccountingAccountCreate(accountId));
        if (shouldCallOnline) {
            try {
                return await accountingRepository.deactivateAccountRemote(accountId);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[accounting] deactivate account failed', { accountId, error: toApiError(error) });
                    await offlineSyncService.setCachedAccountingAccounts(previousAccounts);
                    await syncCashBankAccountsFromAccounting(previousAccounts);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Account deactivation saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[accounting] keeping local account deactivation after cloud rejection', { accountId, error: toApiError(error) });
            }
        }

        return queueAndAttemptSync(
            { type: 'deactivate_accounting_account', payload: { id: accountId } },
            syncMessage
        );
    },
    getLedgers: async (params?: { includeInactive?: boolean }) => {
        try {
            const response = await accountingRepository.getLedgersRemote(params);
            const currentAccounts = await offlineSyncService.getCachedAccountingAccounts();
            if (currentAccounts.length > 0) {
                const balanceById = new Map((response.data?.data ?? []).map((entry) => [entry.id, Number(entry.balance ?? 0)]));
                const nextAccounts = currentAccounts.map((entry) => ({
                    ...entry,
                    balance: balanceById.get(entry.id) ?? Number(entry.balance ?? 0),
                }));
                await offlineSyncService.setCachedAccountingAccounts(nextAccounts);
            }
            return response;
        } catch {
            const cached = await offlineSyncService.getCachedAccountingAccounts();
            const offline = buildOfflineLedgerRows(filterCachedAccounts(cached, { includeInactive: params?.includeInactive }));
            return {
                ok: true,
                data: { data: offline.rows, totals: offline.totals },
            } as ApiResponse<{
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
            }>;
        }
    },
    getTrialBalance: async () => {
        try {
            return await accountingRepository.getTrialBalanceRemote();
        } catch {
            const cached = await offlineSyncService.getCachedAccountingAccounts();
            const offline = buildOfflineTrialBalance(cached);
            return { ok: true, data: offline } as ApiResponse<{
                rows: {
                    accountId: string;
                    accountName: string;
                    accountType: string;
                    debitTotal: number;
                    creditTotal: number;
                }[];
                totals: { debit: number; credit: number; isBalanced: boolean };
            }>;
        }
    },
    getLedger: async (accountId: string, params?: PaginationParams) => {
        try {
            return await accountingRepository.getLedgerRemote(accountId, params);
        } catch (error) {
            const cached = await offlineSyncService.getCachedAccountingAccounts();
            const account = cached.find((entry) => entry.id === accountId);
            if (!account) {
                throw error;
            }
            return {
                ok: true,
                data: {
                    account: {
                        id: account.id,
                        code: account.code,
                        name: account.name,
                        type: account.type,
                    },
                    currentBalance: Number(account.balance ?? 0),
                    entries: [],
                },
            } as ApiResponse<{
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
            }>;
        }
    },
    createJournalRemote: (data: { date?: string; narration?: string; lines: { accountId: string; debit?: number; credit?: number }[] }) =>
        api.post<ApiResponse<{ id: string }>>('/api/accounting/journal', data),
    createJournal: async (data: { date?: string; narration?: string; lines: { accountId: string; debit?: number; credit?: number }[] }) => {
        let syncMessage = 'Journal saved locally. Sync pending.';
        if (await isOnline()) {
            try {
                return await accountingRepository.createJournalRemote(data);
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) throw error;
                if (isCloudWriteBlockedError(error)) syncMessage = 'Journal saved locally. Cloud sync blocked by subscription.';
            }
        }
        await queueAndAttemptSync({ type: 'create_journal', payload: data as any }, syncMessage);
        return { ok: true, data: { id: offlineSyncService.createLocalId('voucher') }, message: syncMessage } as ApiResponse<{ id: string }>;
    },
};
