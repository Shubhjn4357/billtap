import { api } from '../api/client';
import { offlineSyncService } from '../services/offlineSyncService';
import type { ApiListResponse, ApiOkResponse, ApiResponse } from '../types/api';
import type { Loan, LoanTransaction } from '../types/domain';

type LoanCreateInput = {
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
};

type LoanTransactionInput = {
    transactionType: 'DISBURSEMENT' | 'REPAYMENT' | 'INTEREST';
    amount: number;
    date?: string;
    notes?: string;
};

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

const buildLocalLoan = (payload: LoanCreateInput): Loan => {
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

const buildLocalLoanTransaction = (loan: Loan, payload: LoanTransactionInput): LoanTransaction => {
    const now = nowIso();
    const currentBalance = Number(loan.currentBalance ?? 0);
    const delta =
        payload.transactionType === 'REPAYMENT'
            ? -Number(payload.amount ?? 0)
            : Number(payload.amount ?? 0);
    const balanceAfter = currentBalance + delta;
    return {
        id: offlineSyncService.createLocalId('loan-txn'),
        loanId: loan.id,
        businessId: loan.businessId ?? 'offline',
        transactionType: payload.transactionType,
        type: payload.transactionType,
        amount: Number(payload.amount ?? 0),
        balanceAfter,
        date: payload.date ?? now,
        description: payload.notes ?? null,
        notes: payload.notes ?? null,
        createdAt: now,
    };
};

const getTransactionsRemote = async (loanId: string) => {
    const res = await api.get<ApiResponse<{ transactions?: LoanTransaction[] }>>(`/api/loans/${loanId}`);
    return {
        ...res,
        data: (res.data?.transactions ?? []).map((entry) => ({
            ...entry,
            type: entry.type ?? entry.transactionType,
            description: entry.description ?? entry.notes ?? null,
        })),
    } as ApiListResponse<LoanTransaction>;
};

export const loanRepository = {
    listRemote: () => api.get<ApiListResponse<Loan>>('/api/loans'),
    getRemote: (id: string) => api.get<ApiResponse<Loan>>(`/api/loans/${id}`),
    getTransactionsRemote,
    list: async () => {
        try {
            const response = await loanRepository.listRemote();
            await offlineSyncService.setCachedLoans(response.data ?? []);
            return response;
        } catch (error) {
            const cached = await offlineSyncService.getCachedLoans();
            if (cached.length > 0) {
                return { ok: true, data: cached };
            }
            throw error;
        }
    },
    get: async (id: string) => {
        try {
            const response = await loanRepository.getRemote(id);
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
    },
    create: async (payload: LoanCreateInput) => {
        const localLoan = buildLocalLoan(payload);
        await offlineSyncService.upsertCachedLoan(localLoan);
        await queueAndAttemptSync(
            {
                type: 'create_loan',
                payload: { ...payload, id: localLoan.id, localId: localLoan.id },
            },
            'Loan saved locally. Sync pending.'
        );
        return {
            ok: true,
            data: localLoan,
            message: 'Loan saved locally. Sync pending.',
        };
    },
    update: (id: string, data: Partial<Loan>) =>
        api.put<ApiResponse<Loan>>(`/api/loans/${id}`, data),
    delete: (id: string) =>
        api.delete<ApiOkResponse>(`/api/loans/${id}`),
    addTransaction: async (loanId: string, payload: LoanTransactionInput) => {
        const cached = await offlineSyncService.getCachedLoans();
        const loan = cached.find((entry) => entry.id === loanId);
        const localTransaction = loan
            ? buildLocalLoanTransaction(loan, payload)
            : {
                id: offlineSyncService.createLocalId('loan-txn'),
                loanId,
                businessId: 'offline',
                transactionType: payload.transactionType,
                type: payload.transactionType,
                amount: Number(payload.amount ?? 0),
                balanceAfter:
                    payload.transactionType === 'REPAYMENT'
                        ? -Number(payload.amount ?? 0)
                        : Number(payload.amount ?? 0),
                date: payload.date ?? nowIso(),
                description: payload.notes ?? null,
                notes: payload.notes ?? null,
                createdAt: nowIso(),
            } satisfies LoanTransaction;

        if (loan) {
            await offlineSyncService.appendCachedLoanTransaction(loanId, localTransaction);
        }

        const queued = await queueAndAttemptSync(
            {
                type: 'add_loan_transaction',
                payload: {
                    loanId,
                    transactionType: payload.transactionType,
                    amount: payload.amount,
                    date: payload.date,
                    notes: payload.notes,
                },
            },
            'Loan transaction saved locally. Sync pending.'
        );

        return {
            ...queued,
            data: localTransaction,
        };
    },
    getTransactions: async (loanId: string) => {
        try {
            return await getTransactionsRemote(loanId);
        } catch (error) {
            const cached = await offlineSyncService.getCachedLoans();
            const loan = cached.find((entry) => entry.id === loanId);
            if (loan?.transactions?.length) {
                return {
                    ok: true,
                    data: loan.transactions,
                };
            }
            throw error;
        }
    },
};
