import { api, isCloudWriteBlockedError, toApiError } from '../api/client';
import { queryClient } from '../state/queryClient';
import { accountingQueryKeys, cashBankQueryKeys } from '../state/domainQueryKeys';
import { isOfflineLikeError, offlineSyncService } from '../services/offlineSyncService';
import { getRuntimeBusinessScope } from '../services/runtimeSession';
import { isOnline } from '../utils/network';
import type { ApiOkResponse, ApiResponse, PaginationParams } from '../types/api';
import type { Account } from '../types/domain';

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

const syncAccountingCacheBalances = async (accounts: Account[]) => {
    const currentAccounts = await offlineSyncService.getCachedAccountingAccounts();
    if (currentAccounts.length === 0) return;
    const balanceById = new Map(accounts.map((entry) => [entry.id, Number(entry.balance ?? 0)]));
    const nextAccounts = currentAccounts.map((entry) => ({
        ...entry,
        balance: balanceById.get(entry.id) ?? Number(entry.balance ?? 0),
    }));
    await offlineSyncService.setCachedAccountingAccounts(nextAccounts);
    queryClient.setQueryData(accountingQueryKeys.accounts(getRuntimeBusinessScope(), {}), undefined);
};

const applyCashBankBalanceChanges = async (
    changes: { accountId: string; delta: number }[]
): Promise<Account[]> => {
    const current = await offlineSyncService.getCachedCashBankAccounts();
    if (current.length === 0) return current;

    const next = current.map((entry) => {
        const delta = changes
            .filter((change) => change.accountId === entry.id)
            .reduce((sum, change) => sum + change.delta, 0);
        if (delta === 0) return entry;
        return {
            ...entry,
            balance: Number(entry.balance ?? 0) + delta,
        };
    });

    await offlineSyncService.setCachedCashBankAccounts(next);
    writeCashBankBalancesQueryCache(next);
    await syncAccountingCacheBalances(next);
    return next;
};

const getLedgerRemote = async (accountId: string, params?: PaginationParams) => {
    const res = await api.get<{
        ok: boolean;
        data?: {
            id?: string;
            voucherId?: string;
            debit?: number;
            credit?: number;
            voucherType?: string;
            voucherNumber?: string;
            date?: string;
            narration?: string | null;
            runningBalance?: number;
        }[];
        accountName?: string;
        currentBalance?: number;
        accountKind?: string;
    }>(`/api/cash-bank/ledger/${accountId}`, { params });
    return {
        ...res,
        data: {
            entries: res.data ?? [],
            accountName: res.accountName ?? null,
            currentBalance: Number(res.currentBalance ?? 0),
            accountKind: res.accountKind ?? null,
        },
    } as ApiResponse<{
        entries: {
            id?: string;
            voucherId?: string;
            debit?: number;
            credit?: number;
            voucherType?: string;
            voucherNumber?: string;
            date?: string;
            narration?: string | null;
            runningBalance?: number;
        }[];
        accountName: string | null;
        currentBalance: number;
        accountKind: string | null;
    }>;
};

export const cashBankRepository = {
    getOperations: () =>
        api.get<ApiResponse<{
            operations: {
                bankAccount: string[];
                cashInHand: string[];
                cheque: string[];
            };
            voucherMapping: Record<string, string>;
        }>>('/api/cash-bank/operations'),
    getSummary: () =>
        api.get<ApiResponse<{
            accounts: Account[];
            recentVouchers: unknown[];
            totalBalance: number;
        }>>('/api/cash-bank/summary'),
    contra: (data: { fromAccountId: string; toAccountId: string; amount: number; narration?: string; date?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/contra', data),
    receiveCheque: (data: { chequeAccountId: string; amount: number; chequeNumber: string; chequeDate?: string; partyId?: string; narration?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/receive', data),
    depositCheque: (data: { chequeAccountId: string; bankAccountId: string; amount: number; date?: string; narration?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/deposit', data),
    bounceCheque: (data: { chequeAccountId: string; bankAccountId: string; amount: number; date?: string; reason?: string }) =>
        api.post<ApiOkResponse>('/api/cash-bank/cheques/bounce', data),
    getBalancesRemote: () =>
        api.get<ApiResponse<Account[]>>('/api/cash-bank/balances'),
    getBalances: async () => {
        try {
            const response = await cashBankRepository.getBalancesRemote();
            await offlineSyncService.setCachedCashBankAccounts(response.data ?? []);
            writeCashBankBalancesQueryCache(response.data ?? []);
            await syncAccountingCacheBalances(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedCashBankAccounts();
            if (cached.length > 0) {
                return { ok: true, data: cached };
            }
            throw error;
        }
    },
    deposit: async (payload: { accountId: string; partyId?: string; amount: number; paymentMode?: string; narration?: string; description?: string; date?: string }) => {
        const balanceChanges = [{ accountId: payload.accountId, delta: Number(payload.amount ?? 0) }];
        const previousBalances = await offlineSyncService.getCachedCashBankAccounts();
        await applyCashBankBalanceChanges(balanceChanges);
        let syncMessage = 'Deposit saved locally. Sync pending.';
        if (await isOnline()) {
            try {
                return await api.post<ApiOkResponse>('/api/cash-bank/deposit', {
                    accountId: payload.accountId,
                    partyId: payload.partyId,
                    amount: payload.amount,
                    paymentMode: payload.paymentMode,
                    date: payload.date,
                    narration: payload.narration ?? payload.description,
                });
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[cash-bank] deposit failed', { payload, error: toApiError(error) });
                    await offlineSyncService.setCachedCashBankAccounts(previousBalances);
                    writeCashBankBalancesQueryCache(previousBalances);
                    await syncAccountingCacheBalances(previousBalances);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Deposit saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[cash-bank] keeping local deposit after cloud rejection', { payload, error: toApiError(error) });
            }
        }
        return queueAndAttemptSync(
            { type: 'cash_bank_deposit', payload },
            syncMessage
        );
    },
    withdraw: async (payload: { accountId: string; partyId?: string; amount: number; paymentMode?: string; narration?: string; description?: string; date?: string }) => {
        const balanceChanges = [{ accountId: payload.accountId, delta: -Number(payload.amount ?? 0) }];
        const previousBalances = await offlineSyncService.getCachedCashBankAccounts();
        await applyCashBankBalanceChanges(balanceChanges);
        let syncMessage = 'Withdrawal saved locally. Sync pending.';
        if (await isOnline()) {
            try {
                return await api.post<ApiOkResponse>('/api/cash-bank/withdraw', {
                    accountId: payload.accountId,
                    partyId: payload.partyId,
                    amount: payload.amount,
                    paymentMode: payload.paymentMode,
                    date: payload.date,
                    narration: payload.narration ?? payload.description,
                });
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[cash-bank] withdraw failed', { payload, error: toApiError(error) });
                    await offlineSyncService.setCachedCashBankAccounts(previousBalances);
                    writeCashBankBalancesQueryCache(previousBalances);
                    await syncAccountingCacheBalances(previousBalances);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Withdrawal saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[cash-bank] keeping local withdrawal after cloud rejection', { payload, error: toApiError(error) });
            }
        }
        return queueAndAttemptSync(
            { type: 'cash_bank_withdraw', payload },
            syncMessage
        );
    },
    transfer: async (payload: { fromAccountId: string; toAccountId: string; amount: number; narration?: string; description?: string; date?: string }) => {
        const amount = Number(payload.amount ?? 0);
        const balanceChanges = [
            { accountId: payload.fromAccountId, delta: -amount },
            { accountId: payload.toAccountId, delta: amount },
        ];
        const previousBalances = await offlineSyncService.getCachedCashBankAccounts();
        await applyCashBankBalanceChanges(balanceChanges);
        let syncMessage = 'Transfer saved locally. Sync pending.';
        if (await isOnline()) {
            try {
                return await api.post<ApiOkResponse>('/api/cash-bank/transfer', {
                    fromAccountId: payload.fromAccountId,
                    toAccountId: payload.toAccountId,
                    amount: payload.amount,
                    date: payload.date,
                    narration: payload.narration ?? payload.description,
                });
            } catch (error) {
                if (!shouldKeepLocalWriteOnError(error)) {
                    console.error('[cash-bank] transfer failed', { payload, error: toApiError(error) });
                    await offlineSyncService.setCachedCashBankAccounts(previousBalances);
                    writeCashBankBalancesQueryCache(previousBalances);
                    await syncAccountingCacheBalances(previousBalances);
                    throw error;
                }
                if (isCloudWriteBlockedError(error)) {
                    syncMessage = 'Transfer saved locally. Cloud sync blocked by subscription.';
                }
                console.warn('[cash-bank] keeping local transfer after cloud rejection', { payload, error: toApiError(error) });
            }
        }
        return queueAndAttemptSync(
            { type: 'cash_bank_transfer', payload },
            syncMessage
        );
    },
    getLedger: async (accountId: string, params?: PaginationParams) => {
        try {
            return await getLedgerRemote(accountId, params);
        } catch (error) {
            const cached = await offlineSyncService.getCachedCashBankAccounts();
            const account = cached.find((entry) => entry.id === accountId);
            if (!account) throw error;
            return {
                ok: true,
                data: {
                    entries: [],
                    accountName: account.name,
                    currentBalance: Number(account.balance ?? 0),
                    accountKind: null,
                },
            };
        }
    },
};
