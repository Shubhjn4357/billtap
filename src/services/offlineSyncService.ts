import { api, getStoredBusinessId, isCloudWriteBlockedError, toApiError } from '../api/client';
import type {
    Account,
    Expense,
    FinancialPeriod,
    Godown,
    Invoice,
    Item,
    Loan,
    LoanTransaction,
    OperationApproval,
    OperationsAuditLog,
    OperationsControls,
    Party,
    StaffInvite,
    StaffMember,
} from '../types/domain';
import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';
import { offlineDomainDatabase } from '../offline/db/offlineDomainDatabase';
import { isOnline } from '../utils/network';

const LEGACY_KEYS = {
    queue: 'vahi_offline_queue_v1',
    items: 'vahi_item_cache_v1',
    parties: 'vahi_party_cache_v1',
    invoices: 'vahi_invoice_cache_v1',
    expenses: 'vahi_expense_cache_v1',
    loans: 'vahi_loan_cache_v1',
    godowns: 'vahi_godown_cache_v1',
    cashBank: 'vahi_cash_bank_cache_v1',
    settings: 'vahi_settings_cache_v1',
};

const COLLECTIONS = {
    items: 'items',
    parties: 'parties',
    invoices: 'invoices',
    expenses: 'expenses',
    loans: 'loans',
    godowns: 'godowns',
    cashBank: 'cash-bank',
    accountingAccounts: 'accounting-accounts',
    staffMembers: 'staff-members',
    staffInvites: 'staff-invites',
    operationsControls: 'operations-controls',
    operationsPeriods: 'operations-periods',
    operationsApprovals: 'operations-approvals',
    operationsAuditLogs: 'operations-audit-logs',
} as const;

const LEGACY_RESET_PREFIX = 'vahi_offline_sqlite_reset_v2';

const MAX_MUTATIONS_PER_FLUSH = 28;
const AUTO_SYNC_INTERVAL_MS = 30_000;
const RETRY_BASE_DELAY_MS = 4_000;
const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_MUTATION = 12;

type OfflineScope = {
    businessId: string | null;
    storageSuffix: string;
};

type StoredOperationsControls = OperationsControls & {
    id: 'controls';
    updatedAt: string;
};

type QueueMutationBase = {
    id: string;
    createdAt: string;
    attemptCount: number;
    status?: 'pending' | 'retrying' | 'blocked_upgrade' | 'conflict_manual';
    lastErrorCode?: string;
    nextRetryAt?: number;
    lastAttemptAt?: string;
    lastError?: string;
};

type QueueMutation =
    | (QueueMutationBase & { type: 'upsert_item'; payload: Record<string, unknown> & { id: string } })
    | (QueueMutationBase & { type: 'adjust_item_stock'; payload: { id: string; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string; godownId?: string | null } })
    | (QueueMutationBase & { type: 'delete_item'; payload: { id: string } })
    | (QueueMutationBase & { type: 'restore_item'; payload: { id: string } })
    | (QueueMutationBase & { type: 'permanent_delete_item'; payload: { id: string } })
    | (QueueMutationBase & { type: 'upsert_party'; payload: Record<string, unknown> & { id: string } })
    | (QueueMutationBase & { type: 'archive_party'; payload: { id: string } })
    | (QueueMutationBase & { type: 'restore_party'; payload: { id: string } })
    | (QueueMutationBase & { type: 'permanent_delete_party'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_invoice'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'record_invoice_payment'; payload: { invoiceId: string; paidAmount?: number; paymentMode?: string; date?: string } })
    | (QueueMutationBase & { type: 'delete_invoice'; payload: { id: string } })
    | (QueueMutationBase & { type: 'update_settings_section'; payload: { section: string; data: Record<string, unknown> } })
    | (QueueMutationBase & { type: 'create_expense'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'upsert_expense'; payload: Record<string, unknown> & { id: string } })
    | (QueueMutationBase & { type: 'archive_expense'; payload: { id: string } })
    | (QueueMutationBase & { type: 'restore_expense'; payload: { id: string } })
    | (QueueMutationBase & { type: 'permanent_delete_expense'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_loan'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'add_loan_transaction'; payload: { loanId: string; transactionType: string; amount: number; date?: string; notes?: string } })
    | (QueueMutationBase & { type: 'cash_bank_deposit'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'cash_bank_withdraw'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'cash_bank_transfer'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'create_godown'; payload: Record<string, unknown> & { localId?: string } })
    | (QueueMutationBase & { type: 'transfer_godown_stock'; payload: { fromGodownId: string; toGodownId: string; itemId: string; quantity: number; notes?: string } })
    | (QueueMutationBase & { type: 'delete_godown'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_pos_sale'; payload: Record<string, unknown> })
    | (QueueMutationBase & { type: 'create_staff_invite'; payload: { id: string; phoneNumber: string; role?: string; code?: string } })
    | (QueueMutationBase & { type: 'update_staff_member'; payload: { uid: string; role?: 'owner' | 'staff'; ownerId?: string | null } })
    | (QueueMutationBase & { type: 'delete_staff'; payload: { uid: string } })
    | (QueueMutationBase & { type: 'delete_staff_invite'; payload: { id: string } })
    | (QueueMutationBase & { type: 'create_accounting_account'; payload: { id: string; code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'; parentId?: string | null } })
    | (QueueMutationBase & { type: 'update_accounting_account'; payload: { id: string; code?: string; name?: string; parentId?: string | null; isActive?: boolean } })
    | (QueueMutationBase & { type: 'deactivate_accounting_account'; payload: { id: string } })
    | (QueueMutationBase & { type: 'set_operations_controls'; payload: Partial<OperationsControls> })
    | (QueueMutationBase & { type: 'lock_operations_period'; payload: { id: string; periodStart?: string; periodEnd?: string; notes?: string } })
    | (QueueMutationBase & { type: 'close_operations_period'; payload: { periodId: string } })
    | (QueueMutationBase & { type: 'reopen_operations_period'; payload: { periodId: string } })
    | (QueueMutationBase & { type: 'create_operation_approval'; payload: { approvalId: string; actionType: 'UPDATE_CONTROLS' | 'LOCK_PERIOD' | 'CLOSE_PERIOD' | 'REOPEN_PERIOD' | 'CUSTOM'; module?: string; payload?: Record<string, unknown> } })
    | (QueueMutationBase & { type: 'approve_operation_approval'; payload: { id: string } })
    | (QueueMutationBase & { type: 'reject_operation_approval'; payload: { id: string; note?: string } });

type EnqueueMutation =
    | { type: 'upsert_item'; payload: Record<string, unknown> & { id: string } }
    | { type: 'adjust_item_stock'; payload: { id: string; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string; godownId?: string | null } }
    | { type: 'delete_item'; payload: { id: string } }
    | { type: 'restore_item'; payload: { id: string } }
    | { type: 'permanent_delete_item'; payload: { id: string } }
    | { type: 'upsert_party'; payload: Record<string, unknown> & { id: string } }
    | { type: 'archive_party'; payload: { id: string } }
    | { type: 'restore_party'; payload: { id: string } }
    | { type: 'permanent_delete_party'; payload: { id: string } }
    | { type: 'create_invoice'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'record_invoice_payment'; payload: { invoiceId: string; paidAmount?: number; paymentMode?: string; date?: string } }
    | { type: 'delete_invoice'; payload: { id: string } }
    | { type: 'update_settings_section'; payload: { section: string; data: Record<string, unknown> } }
    | { type: 'create_expense'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'upsert_expense'; payload: Record<string, unknown> & { id: string } }
    | { type: 'archive_expense'; payload: { id: string } }
    | { type: 'restore_expense'; payload: { id: string } }
    | { type: 'permanent_delete_expense'; payload: { id: string } }
    | { type: 'create_loan'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'add_loan_transaction'; payload: { loanId: string; transactionType: string; amount: number; date?: string; notes?: string } }
    | { type: 'cash_bank_deposit'; payload: Record<string, unknown> }
    | { type: 'cash_bank_withdraw'; payload: Record<string, unknown> }
    | { type: 'cash_bank_transfer'; payload: Record<string, unknown> }
    | { type: 'create_godown'; payload: Record<string, unknown> & { localId?: string } }
    | { type: 'transfer_godown_stock'; payload: { fromGodownId: string; toGodownId: string; itemId: string; quantity: number; notes?: string } }
    | { type: 'delete_godown'; payload: { id: string } }
    | { type: 'create_pos_sale'; payload: Record<string, unknown> }
    | { type: 'create_staff_invite'; payload: { id: string; phoneNumber: string; role?: string; code?: string } }
    | { type: 'update_staff_member'; payload: { uid: string; role?: 'owner' | 'staff'; ownerId?: string | null } }
    | { type: 'delete_staff'; payload: { uid: string } }
    | { type: 'delete_staff_invite'; payload: { id: string } }
    | { type: 'create_accounting_account'; payload: { id: string; code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'; parentId?: string | null } }
    | { type: 'update_accounting_account'; payload: { id: string; code?: string; name?: string; parentId?: string | null; isActive?: boolean } }
    | { type: 'deactivate_accounting_account'; payload: { id: string } }
    | { type: 'set_operations_controls'; payload: Partial<OperationsControls> }
    | { type: 'lock_operations_period'; payload: { id: string; periodStart?: string; periodEnd?: string; notes?: string } }
    | { type: 'close_operations_period'; payload: { periodId: string } }
    | { type: 'reopen_operations_period'; payload: { periodId: string } }
    | { type: 'create_operation_approval'; payload: { approvalId: string; actionType: 'UPDATE_CONTROLS' | 'LOCK_PERIOD' | 'CLOSE_PERIOD' | 'REOPEN_PERIOD' | 'CUSTOM'; module?: string; payload?: Record<string, unknown> } }
    | { type: 'approve_operation_approval'; payload: { id: string } }
    | { type: 'reject_operation_approval'; payload: { id: string; note?: string } };

let flushInFlightByScope = new Map<string, Promise<{ processed: number; remaining: number }>>();
let enqueueMutex: Promise<void> = Promise.resolve();
let autoSyncHandle: ReturnType<typeof setInterval> | null = null;
let queuedFlushTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let initializationByScope = new Map<string, Promise<void>>();
let queueChangeListeners = new Set<() => void>();

const getOfflineScope = async (): Promise<OfflineScope> => {
    const storedBusinessId = (await getStoredBusinessId())?.trim() ?? '';
    return {
        businessId: storedBusinessId || null,
        storageSuffix: storedBusinessId || 'default',
    };
};

const toScopeId = (scope: OfflineScope) => scope.businessId || 'default';

const getLegacyResetKey = (scope: OfflineScope) => `${LEGACY_RESET_PREFIX}::${scope.storageSuffix}`;
const getScopedStorageKey = (key: string, scope: OfflineScope) => `${key}::${scope.storageSuffix}`;

const ensureScopeInitialized = async (scope: OfflineScope): Promise<void> => {
    const existing = initializationByScope.get(scope.storageSuffix);
    if (existing) return existing;

    const task = (async () => {
        const resetKey = getLegacyResetKey(scope);
        const alreadyReset = await offlineKeyValueStore.getItem(resetKey);
        if (alreadyReset === '1') return;

        await offlineDomainDatabase.clearScope(toScopeId(scope));
        await offlineKeyValueStore.multiRemove([
            getScopedStorageKey(LEGACY_KEYS.queue, scope),
            getScopedStorageKey(LEGACY_KEYS.items, scope),
            getScopedStorageKey(LEGACY_KEYS.parties, scope),
            getScopedStorageKey(LEGACY_KEYS.invoices, scope),
            getScopedStorageKey(LEGACY_KEYS.expenses, scope),
            getScopedStorageKey(LEGACY_KEYS.loans, scope),
            getScopedStorageKey(LEGACY_KEYS.godowns, scope),
            getScopedStorageKey(LEGACY_KEYS.cashBank, scope),
            getScopedStorageKey(LEGACY_KEYS.settings, scope),
            LEGACY_KEYS.queue,
            LEGACY_KEYS.items,
            LEGACY_KEYS.parties,
            LEGACY_KEYS.invoices,
            LEGACY_KEYS.expenses,
            LEGACY_KEYS.loans,
            LEGACY_KEYS.godowns,
            LEGACY_KEYS.cashBank,
            LEGACY_KEYS.settings,
        ]);
        await offlineKeyValueStore.setItem(resetKey, '1');
    })();

    initializationByScope.set(scope.storageSuffix, task);
    try {
        await task;
    } finally {
        initializationByScope.delete(scope.storageSuffix);
    }
};

const toErrorMessage = (error: unknown): string => {
    const normalized = toApiError(error);
    if (normalized.message?.trim()) return normalized.message.trim();
    if (typeof normalized.details === 'string' && normalized.details.trim()) {
        return normalized.details.trim();
    }
    if (error && typeof error === 'object') {
        try {
            return JSON.stringify(error);
        } catch {
            return 'Unexpected error';
        }
    }
    return typeof error === 'string' && error.trim() ? error.trim() : 'Unexpected error';
};

const getErrorStatus = (error: unknown): number => toApiError(error).status ?? 0;

const getErrorCode = (error: unknown): string | undefined => {
    const code = toApiError(error).code;
    return typeof code === 'string' && code.trim() ? code.trim() : undefined;
};

const logMutationError = (phase: string, mutation: QueueMutation, error: unknown) => {
    if (isCloudWriteBlockedError(error)) {
        return;
    }
    console.error(`[offline-sync] ${phase} failed`, {
        mutationId: mutation.id,
        mutationType: mutation.type,
        payload: mutation.payload,
        error: toApiError(error),
    });
};

export const isOfflineLikeError = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    if (status > 0) {
        return status === 408 || status === 429 || status >= 500;
    }

    const message = toErrorMessage(error).toLowerCase();
    return (
        message.includes('network')
        || message.includes('timeout')
        || message.includes('internet')
        || message.includes('fetch')
        || message.includes('offline')
    );
};

const shouldDropMutation = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    if (status <= 0) return false;
    if (status === 404 || status === 422) return true;
    return false;
};

const shouldStopFlush = (error: unknown): boolean => getErrorStatus(error) === 401;
const isConflictMutationError = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    return status === 409 || status === 412;
};

const isUpgradeBlockedMutationError = (error: unknown): boolean => {
    if (isCloudWriteBlockedError(error)) {
        return true;
    }
    const normalized = toApiError(error);
    const status = normalized.status;
    const message = String(normalized.message ?? '').toLowerCase();
    return status === 403 || (status === 409 && message.includes('plan'));
};

const extractMutationErrorCode = (error: unknown): string | undefined => getErrorCode(error);
const getRetryDelayMs = (attemptCount: number): number => {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, Math.min(attemptCount - 1, 5));
    return Math.min(delay, RETRY_MAX_DELAY_MS);
};

const generateLocalId = (prefix: string): string =>
    `local_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeQueueMutation = (raw: QueueMutation): QueueMutation => ({
    ...raw,
    attemptCount: raw.attemptCount ?? 0,
    status: raw.status ?? 'pending',
});

const asUpsertItemMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'upsert_item' }> | null =>
    mutation.type === 'upsert_item' ? mutation : null;

const asUpsertPartyMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'upsert_party' }> | null =>
    mutation.type === 'upsert_party' ? mutation : null;

const asUpsertExpenseMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'upsert_expense' }> | null =>
    mutation.type === 'upsert_expense' ? mutation : null;

const asSettingsMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'update_settings_section' }> | null =>
    mutation.type === 'update_settings_section' ? mutation : null;

const asRecordPaymentMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'record_invoice_payment' }> | null =>
    mutation.type === 'record_invoice_payment' ? mutation : null;

const asUpdateStaffMemberMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'update_staff_member' }> | null =>
    mutation.type === 'update_staff_member' ? mutation : null;

const asUpdateAccountingAccountMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'update_accounting_account' }> | null =>
    mutation.type === 'update_accounting_account' ? mutation : null;

const asSetOperationsControlsMutation = (
    mutation: QueueMutation
): Extract<QueueMutation, { type: 'set_operations_controls' }> | null =>
    mutation.type === 'set_operations_controls' ? mutation : null;

const compactQueueForEnqueue = (
    queue: QueueMutation[],
    mutation: EnqueueMutation
): QueueMutation[] => {
    const full = {
        ...mutation,
        id: generateLocalId('mut'),
        createdAt: new Date().toISOString(),
        attemptCount: 0,
    } as QueueMutation;

    if (mutation.type === 'upsert_item') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'upsert_item' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter((entry) => {
                const candidate = asUpsertItemMutation(entry);
                return !(candidate && candidate.payload.id === targetId);
            }),
            full,
        ];
    }

    if (mutation.type === 'upsert_party') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'upsert_party' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter((entry) => {
                const candidate = asUpsertPartyMutation(entry);
                return !(candidate && candidate.payload.id === targetId);
            }),
            full,
        ];
    }

    if (mutation.type === 'upsert_expense') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'upsert_expense' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter((entry) => {
                const candidate = asUpsertExpenseMutation(entry);
                return !(candidate && candidate.payload.id === targetId);
            }),
            full,
        ];
    }

    if (mutation.type === 'update_settings_section') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'update_settings_section' }>;
        const targetSection = typed.payload.section;
        return [
            ...queue.filter((entry) => {
                const candidate = asSettingsMutation(entry);
                return !(candidate && candidate.payload.section === targetSection);
            }),
            full,
        ];
    }

    if (mutation.type === 'record_invoice_payment') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'record_invoice_payment' }>;
        const targetInvoiceId = typed.payload.invoiceId;
        return [
            ...queue.filter((entry) => {
                const candidate = asRecordPaymentMutation(entry);
                return !(candidate && candidate.payload.invoiceId === targetInvoiceId);
            }),
            full,
        ];
    }

    if (mutation.type === 'update_staff_member') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'update_staff_member' }>;
        const targetUid = typed.payload.uid;
        return [
            ...queue.filter((entry) => {
                const candidate = asUpdateStaffMemberMutation(entry);
                return !(candidate && candidate.payload.uid === targetUid);
            }),
            full,
        ];
    }

    if (mutation.type === 'update_accounting_account') {
        const typed = mutation as Extract<EnqueueMutation, { type: 'update_accounting_account' }>;
        const targetId = typed.payload.id;
        return [
            ...queue.filter((entry) => {
                const candidate = asUpdateAccountingAccountMutation(entry);
                return !(candidate && candidate.payload.id === targetId);
            }),
            full,
        ];
    }

    if (mutation.type === 'set_operations_controls') {
        return [
            ...queue.filter((entry) => !asSetOperationsControlsMutation(entry)),
            full,
        ];
    }

    return [...queue, full];
};

const clearScheduledFlush = (scope: OfflineScope) => {
    const existingHandle = queuedFlushTimeouts.get(scope.storageSuffix);
    if (!existingHandle) return;
    clearTimeout(existingHandle);
    queuedFlushTimeouts.delete(scope.storageSuffix);
};

const emitQueueChanged = () => {
    for (const listener of queueChangeListeners) {
        try {
            listener();
        } catch (error) {
            console.error('[offline-sync] queue listener failed', { error });
        }
    }
};

const scheduleFlushSoon = (scope: OfflineScope, delayMs = 300) => {
    clearScheduledFlush(scope);
    const handle = setTimeout(() => {
        queuedFlushTimeouts.delete(scope.storageSuffix);
        void offlineSyncService.flushQueueForScope(scope);
    }, delayMs);
    queuedFlushTimeouts.set(scope.storageSuffix, handle);
};

const normalizePartyMutationPayload = (payload: Record<string, unknown>) => ({
    id: String(payload.id ?? ''),
    name: String(payload.name ?? ''),
    type: String(payload.type ?? '').toUpperCase() === 'SUPPLIER' ? 'supplier' : 'customer',
    phone: typeof payload.phone === 'string' ? payload.phone : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    address:
        typeof payload.address === 'string'
            ? payload.address
            : typeof payload.billingAddress === 'string'
                ? payload.billingAddress
                : undefined,
    gstNumber:
        typeof payload.gstNumber === 'string'
            ? payload.gstNumber
            : typeof payload.gstin === 'string'
                ? payload.gstin
                : undefined,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
});

const normalizeItemMutationPayload = (payload: Record<string, unknown>) => ({
    id: String(payload.id ?? ''),
    name: String(payload.name ?? ''),
    price: Number(payload.price ?? payload.salePrice ?? 0),
    stock: Number(payload.stock ?? payload.openingStock ?? 0),
    purchasePrice: Number(payload.purchasePrice ?? 0),
    mrp: Number(payload.mrp ?? payload.price ?? payload.salePrice ?? 0),
    minimumStock: Number(payload.minimumStock ?? payload.reorderLevel ?? 0),
    unit:
        typeof payload.unit === 'string' && payload.unit.trim().length > 0
            ? payload.unit.trim()
            : 'pcs',
    hsn:
        typeof payload.hsn === 'string'
            ? payload.hsn
            : typeof payload.hsnCode === 'string'
                ? payload.hsnCode
                : undefined,
    gstPercentage: Number(payload.gstPercentage ?? payload.gstRate ?? 0),
    category: typeof payload.category === 'string' ? payload.category : undefined,
    description: typeof payload.description === 'string' ? payload.description : undefined,
    location: typeof payload.location === 'string' ? payload.location : undefined,
    barcode: typeof payload.barcode === 'string' ? payload.barcode : undefined,
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    autoDeleteEnabled: payload.autoDeleteEnabled === undefined ? false : Boolean(payload.autoDeleteEnabled),
    godownId:
        typeof payload.godownId === 'string'
            ? payload.godownId
            : payload.godownId === null
                ? null
                : undefined,
    autoDeleteAt:
        typeof payload.autoDeleteAt === 'string' || payload.autoDeleteAt === null
            ? payload.autoDeleteAt
            : undefined,
    expiresAt:
        typeof payload.expiresAt === 'string' || payload.expiresAt === null
            ? payload.expiresAt
            : undefined,
});

const normalizeItemAdjustmentPayload = (
    payload: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string; godownId?: string | null }
) => ({
    type: payload.type,
    quantity: Number(payload.quantity ?? 0),
    reason: typeof payload.reason === 'string' && payload.reason.trim().length > 0 ? payload.reason.trim() : undefined,
    godownId:
        typeof payload.godownId === 'string'
            ? payload.godownId
            : payload.godownId === null
                ? null
                : undefined,
});

const normalizeCashBankPayload = (payload: Record<string, unknown>) => ({
    ...payload,
    narration:
        typeof payload.narration === 'string'
            ? payload.narration
            : typeof payload.description === 'string'
                ? payload.description
                : undefined,
});

const applyMutation = async (mutation: QueueMutation): Promise<void> => {
    switch (mutation.type) {
        case 'upsert_item':
            await api.post('/api/items', normalizeItemMutationPayload(mutation.payload));
            return;
        case 'adjust_item_stock':
            await api.post(
                `/api/items/${encodeURIComponent(mutation.payload.id)}/adjust`,
                normalizeItemAdjustmentPayload(mutation.payload)
            );
            return;
        case 'delete_item':
            await api.delete(`/api/items/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'restore_item':
            await api.post(`/api/items/${encodeURIComponent(mutation.payload.id)}/restore`, {});
            return;
        case 'permanent_delete_item':
            await api.delete(`/api/items/${encodeURIComponent(mutation.payload.id)}/permanent`);
            return;
        case 'upsert_party':
            await api.post('/api/parties', normalizePartyMutationPayload(mutation.payload));
            return;
        case 'archive_party':
            await api.patch(`/api/parties/${encodeURIComponent(mutation.payload.id)}`, { isActive: false });
            return;
        case 'restore_party':
            await api.post(`/api/parties/${encodeURIComponent(mutation.payload.id)}/restore`, {});
            return;
        case 'permanent_delete_party':
            await api.delete(`/api/parties/${encodeURIComponent(mutation.payload.id)}/permanent`);
            return;
        case 'create_invoice': {
            const payload = { ...mutation.payload };
            if (typeof payload.localId === 'string' && payload.localId.trim()) {
                payload.id = payload.localId.trim();
            }
            delete payload.localId;
            await api.post('/api/transactions', payload);
            return;
        }
        case 'record_invoice_payment':
            await api.patch(
                `/api/transactions/${encodeURIComponent(mutation.payload.invoiceId)}/payment`,
                {
                    paidAmount: mutation.payload.paidAmount,
                    paymentMode: mutation.payload.paymentMode,
                    date: mutation.payload.date,
                }
            );
            return;
        case 'delete_invoice':
            await api.delete(`/api/transactions/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'update_settings_section':
            await api.put(`/api/settings/${encodeURIComponent(mutation.payload.section)}`, {
                data: mutation.payload.data,
            });
            return;
        case 'create_expense': {
            const payload = { ...mutation.payload };
            if (!payload.id && typeof payload.localId === 'string' && payload.localId.trim()) {
                payload.id = payload.localId.trim();
            }
            delete payload.localId;
            await api.post('/api/expenses', payload);
            return;
        }
        case 'upsert_expense': {
            const { id: expenseId, ...payload } = mutation.payload;
            await api.put(`/api/expenses/${encodeURIComponent(expenseId)}`, payload);
            return;
        }
        case 'archive_expense':
            await api.delete(`/api/expenses/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'restore_expense':
            await api.post(`/api/expenses/${encodeURIComponent(mutation.payload.id)}/restore`, {});
            return;
        case 'permanent_delete_expense':
            await api.delete(`/api/expenses/${encodeURIComponent(mutation.payload.id)}/permanent`);
            return;
        case 'create_loan': {
            const payload = { ...mutation.payload };
            if (!payload.id && typeof payload.localId === 'string' && payload.localId.trim()) {
                payload.id = payload.localId.trim();
            }
            delete payload.localId;
            await api.post('/api/loans', payload);
            return;
        }
        case 'add_loan_transaction':
            await api.post(
                `/api/loans/${encodeURIComponent(mutation.payload.loanId)}/transactions`,
                {
                    transactionType: mutation.payload.transactionType,
                    amount: mutation.payload.amount,
                    date: mutation.payload.date,
                    notes: mutation.payload.notes,
                }
            );
            return;
        case 'cash_bank_deposit':
            await api.post('/api/cash-bank/deposit', normalizeCashBankPayload(mutation.payload));
            return;
        case 'cash_bank_withdraw':
            await api.post('/api/cash-bank/withdraw', normalizeCashBankPayload(mutation.payload));
            return;
        case 'cash_bank_transfer':
            await api.post('/api/cash-bank/transfer', normalizeCashBankPayload(mutation.payload));
            return;
        case 'create_godown': {
            const payload = { ...mutation.payload };
            if (!payload.id && typeof payload.localId === 'string' && payload.localId.trim()) {
                payload.id = payload.localId.trim();
            }
            delete payload.localId;
            await api.post('/api/godowns', payload);
            return;
        }
        case 'transfer_godown_stock':
            await api.post('/api/godowns/transfer', mutation.payload);
            return;
        case 'delete_godown':
            await api.delete(`/api/godowns/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'create_pos_sale':
            await api.post('/api/pos/sale', mutation.payload);
            return;
        case 'create_staff_invite':
            await api.post('/api/staff', mutation.payload);
            return;
        case 'update_staff_member':
            await api.patch(`/api/staff/${encodeURIComponent(mutation.payload.uid)}`, {
                ...(mutation.payload.role !== undefined ? { role: mutation.payload.role } : {}),
                ...(mutation.payload.ownerId !== undefined ? { ownerId: mutation.payload.ownerId } : {}),
            });
            return;
        case 'delete_staff':
            await api.delete(`/api/staff/${encodeURIComponent(mutation.payload.uid)}`);
            return;
        case 'delete_staff_invite':
            await api.delete(`/api/staff/invite/${encodeURIComponent(mutation.payload.id)}`);
            return;
        case 'create_accounting_account':
            await api.post('/api/accounting/accounts', mutation.payload);
            return;
        case 'update_accounting_account': {
            const { id: accountId, ...payload } = mutation.payload;
            await api.patch(`/api/accounting/accounts/${encodeURIComponent(accountId)}`, payload);
            return;
        }
        case 'deactivate_accounting_account':
            await api.post(`/api/accounting/accounts/${encodeURIComponent(mutation.payload.id)}/deactivate`, {});
            return;
        case 'set_operations_controls':
            await api.put('/api/operations/controls', mutation.payload);
            return;
        case 'lock_operations_period':
            await api.post('/api/operations/periods/lock', mutation.payload);
            return;
        case 'close_operations_period':
            await api.post(`/api/operations/periods/${encodeURIComponent(mutation.payload.periodId)}/close`, {});
            return;
        case 'reopen_operations_period':
            await api.post(`/api/operations/periods/${encodeURIComponent(mutation.payload.periodId)}/reopen`, {});
            return;
        case 'create_operation_approval':
            await api.post('/api/operations/approvals', {
                actionType: mutation.payload.actionType,
                module: mutation.payload.module ?? 'operations',
                payload: mutation.payload.payload ?? {},
                approvalId: mutation.payload.approvalId,
            });
            return;
        case 'approve_operation_approval':
            await api.post(`/api/operations/approvals/${encodeURIComponent(mutation.payload.id)}/approve`, {});
            return;
        case 'reject_operation_approval':
            await api.post(`/api/operations/approvals/${encodeURIComponent(mutation.payload.id)}/reject`, {
                ...(mutation.payload.note ? { note: mutation.payload.note } : {}),
            });
            return;
        default:
            return;
    }
};

const asObject = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const resolveConflict = async (mutation: QueueMutation): Promise<boolean> => {
    try {
        switch (mutation.type) {
            case 'upsert_item':
                await api.patch(
                    `/api/items/${encodeURIComponent(mutation.payload.id)}`,
                    normalizeItemMutationPayload(mutation.payload)
                );
                return true;
            case 'adjust_item_stock':
            case 'restore_item':
            case 'permanent_delete_item':
                return true;
            case 'upsert_party':
                await api.patch(
                    `/api/parties/${encodeURIComponent(mutation.payload.id)}`,
                    normalizePartyMutationPayload(mutation.payload)
                );
                return true;
            case 'restore_party':
            case 'permanent_delete_party':
                return true;
            case 'upsert_expense': {
                const { id: expenseId, ...payload } = mutation.payload;
                await api.put(`/api/expenses/${encodeURIComponent(expenseId)}`, payload);
                return true;
            }
            case 'archive_expense':
            case 'restore_expense':
            case 'permanent_delete_expense':
                return true;
            case 'update_settings_section': {
                const current = await api.get<{ ok?: boolean; data?: Record<string, unknown> }>(
                    `/api/settings/${encodeURIComponent(mutation.payload.section)}`
                );
                await api.put(`/api/settings/${encodeURIComponent(mutation.payload.section)}`, {
                    data: {
                        ...asObject(current.data),
                        ...mutation.payload.data,
                    },
                });
                return true;
            }
            case 'record_invoice_payment': {
                const current = await api.get<{
                    ok?: boolean;
                    transaction?: {
                        paidAmount?: number;
                        paymentStatus?: string;
                    };
                }>(`/api/transactions/${encodeURIComponent(mutation.payload.invoiceId)}`);
                const remotePaid = Number(current.transaction?.paidAmount ?? 0);
                const localPaid = Number(mutation.payload.paidAmount ?? 0);
                if (remotePaid >= localPaid) {
                    return true;
                }
                await api.patch(
                    `/api/transactions/${encodeURIComponent(mutation.payload.invoiceId)}/payment`,
                    {
                        paidAmount: mutation.payload.paidAmount,
                        paymentMode: mutation.payload.paymentMode,
                        date: mutation.payload.date,
                    }
                );
                return true;
            }
            case 'archive_party':
            case 'delete_item':
            case 'delete_invoice':
            case 'transfer_godown_stock':
            case 'delete_godown':
            case 'add_loan_transaction':
            case 'delete_staff':
            case 'delete_staff_invite':
            case 'deactivate_accounting_account':
            case 'approve_operation_approval':
            case 'reject_operation_approval':
            case 'create_pos_sale':
                return true;
            default:
                return false;
        }
    } catch (error) {
        logMutationError('resolve-conflict', mutation, error);
        return false;
    }
};

const readCollection = async <T>(scope: OfflineScope, collection: string): Promise<T[]> => {
    await ensureScopeInitialized(scope);
    return offlineDomainDatabase.listRecords<T>(toScopeId(scope), collection);
};

const replaceCollection = async <T extends { id: string; updatedAt?: string; createdAt?: string }>(
    scope: OfflineScope,
    collection: string,
    rows: T[]
): Promise<void> => {
    await ensureScopeInitialized(scope);
    await offlineDomainDatabase.replaceRecords(toScopeId(scope), collection, rows, (row) => row.id);
};

const upsertCollectionRecord = async <T extends { id: string; updatedAt?: string; createdAt?: string }>(
    scope: OfflineScope,
    collection: string,
    row: T
): Promise<void> => {
    await ensureScopeInitialized(scope);
    await offlineDomainDatabase.upsertRecord(toScopeId(scope), collection, row.id, row);
};

const removeCollectionRecord = async (
    scope: OfflineScope,
    collection: string,
    recordId: string
): Promise<void> => {
    await ensureScopeInitialized(scope);
    await offlineDomainDatabase.removeRecord(toScopeId(scope), collection, recordId);
};

class OfflineSyncService {
    createLocalId(prefix: string): string {
        return generateLocalId(prefix);
    }

    getStorageBackend(): string {
        return 'expo-sqlite-domain-db';
    }

    subscribe(listener: () => void): () => void {
        queueChangeListeners.add(listener);
        return () => {
            queueChangeListeners.delete(listener);
        };
    }

    private async getQueueForScope(scope: OfflineScope): Promise<QueueMutation[]> {
        await ensureScopeInitialized(scope);
        const queue = await offlineDomainDatabase.getOutbox<QueueMutation>(toScopeId(scope));
        return queue.map(normalizeQueueMutation);
    }

    private async writeQueueForScope(scope: OfflineScope, queue: QueueMutation[]): Promise<void> {
        await ensureScopeInitialized(scope);
        await offlineDomainDatabase.replaceOutbox(toScopeId(scope), queue);
        emitQueueChanged();
    }

    async getQueue(): Promise<QueueMutation[]> {
        const scope = await getOfflineScope();
        return this.getQueueForScope(scope);
    }

    async enqueueMutation(mutation: EnqueueMutation): Promise<void> {
        const scope = await getOfflineScope();
        enqueueMutex = enqueueMutex.then(async () => {
            const queue = await this.getQueueForScope(scope);
            const nextQueue = compactQueueForEnqueue(queue, mutation);
            await this.writeQueueForScope(scope, nextQueue);
            scheduleFlushSoon(scope);
        });
        await enqueueMutex;
    }

    async getQueueStats(): Promise<{
        pendingCount: number;
        blockedCount: number;
        oldestCreatedAt: string | null;
    }> {
        const queue = await this.getQueue();
        return {
            pendingCount: queue.length,
            blockedCount: queue.filter((entry) => entry.status === 'blocked_upgrade').length,
            oldestCreatedAt: queue[0]?.createdAt ?? null,
        };
    }

    async flushQueueForScope(scope: OfflineScope): Promise<{ processed: number; remaining: number }> {
        const inFlight = flushInFlightByScope.get(scope.storageSuffix);
        if (inFlight) return inFlight;

        const task = (async () => {
            await ensureScopeInitialized(scope);
            const queue = await this.getQueueForScope(scope);
            if (queue.length === 0) {
                clearScheduledFlush(scope);
                return { processed: 0, remaining: 0 };
            }

            const online = await isOnline();
            if (!online) {
                return { processed: 0, remaining: queue.length };
            }

            let processed = 0;
            let stopIndex = queue.length;
            const nextQueue: QueueMutation[] = [];
            const now = Date.now();

            for (let index = 0; index < queue.length; index += 1) {
                const mutation = normalizeQueueMutation(queue[index]);
                if (processed >= MAX_MUTATIONS_PER_FLUSH) {
                    stopIndex = index;
                    break;
                }

                if (mutation.status === 'blocked_upgrade' || mutation.status === 'conflict_manual') {
                    nextQueue.push(mutation);
                    continue;
                }

                if (typeof mutation.nextRetryAt === 'number' && mutation.nextRetryAt > now) {
                    nextQueue.push(mutation);
                    continue;
                }

                try {
                    await applyMutation(mutation);
                    processed += 1;
                } catch (error) {
                    logMutationError('apply-mutation', mutation, error);

                    if (shouldStopFlush(error)) {
                        nextQueue.push({
                            ...mutation,
                            status: 'retrying',
                            attemptCount: mutation.attemptCount + 1,
                            lastAttemptAt: new Date().toISOString(),
                            lastError: toErrorMessage(error),
                            lastErrorCode: extractMutationErrorCode(error),
                            nextRetryAt: Date.now() + getRetryDelayMs(mutation.attemptCount + 1),
                        });
                        stopIndex = index + 1;
                        break;
                    }

                    if (isUpgradeBlockedMutationError(error)) {
                        nextQueue.push({
                            ...mutation,
                            status: 'blocked_upgrade',
                            lastAttemptAt: new Date().toISOString(),
                            lastError: toErrorMessage(error),
                            lastErrorCode: extractMutationErrorCode(error),
                            nextRetryAt: undefined,
                        });
                        continue;
                    }

                    if (isConflictMutationError(error)) {
                        const resolved = await resolveConflict(mutation);
                        if (resolved) {
                            processed += 1;
                            continue;
                        }
                        nextQueue.push({
                            ...mutation,
                            status: 'conflict_manual',
                            attemptCount: mutation.attemptCount + 1,
                            lastAttemptAt: new Date().toISOString(),
                            lastError: toErrorMessage(error),
                            lastErrorCode: extractMutationErrorCode(error),
                            nextRetryAt: undefined,
                        });
                        continue;
                    }

                    if (shouldDropMutation(error)) {
                        processed += 1;
                        continue;
                    }

                    const nextAttemptCount = mutation.attemptCount + 1;
                    const retryStatus =
                        nextAttemptCount >= MAX_ATTEMPTS_PER_MUTATION ? 'conflict_manual' : 'retrying';
                    nextQueue.push({
                        ...mutation,
                        status: retryStatus,
                        attemptCount: nextAttemptCount,
                        lastAttemptAt: new Date().toISOString(),
                        lastError: toErrorMessage(error),
                        lastErrorCode: extractMutationErrorCode(error),
                        nextRetryAt:
                            retryStatus === 'retrying'
                                ? Date.now() + getRetryDelayMs(nextAttemptCount)
                                : undefined,
                    });
                }
            }

            for (let index = stopIndex; index < queue.length; index += 1) {
                nextQueue.push(normalizeQueueMutation(queue[index]));
            }

            await this.writeQueueForScope(scope, nextQueue);

            const nextRetryAt = nextQueue
                .filter((entry) => typeof entry.nextRetryAt === 'number')
                .reduce<number | null>((earliest, entry) => {
                    const retryAt = entry.nextRetryAt as number;
                    if (earliest === null || retryAt < earliest) return retryAt;
                    return earliest;
                }, null);

            if (nextRetryAt !== null) {
                scheduleFlushSoon(scope, Math.max(nextRetryAt - Date.now(), 250));
            } else if (nextQueue.length === 0) {
                clearScheduledFlush(scope);
            }

            return { processed, remaining: nextQueue.length };
        })();

        flushInFlightByScope.set(scope.storageSuffix, task);
        try {
            return await task;
        } finally {
            flushInFlightByScope.delete(scope.storageSuffix);
        }
    }

    async flushQueue(): Promise<{ processed: number; remaining: number }> {
        const scope = await getOfflineScope();
        return this.flushQueueForScope(scope);
    }

    startAutoSync(intervalMs = AUTO_SYNC_INTERVAL_MS): void {
        if (autoSyncHandle) return;
        autoSyncHandle = setInterval(() => {
            void this.flushQueue();
        }, intervalMs);
    }

    stopAutoSync(): void {
        if (!autoSyncHandle) return;
        clearInterval(autoSyncHandle);
        autoSyncHandle = null;
    }

    onNetworkStateChange(online: boolean): void {
        if (!online) return;
        void this.flushQueue();
    }

    async clearAllLocalData(): Promise<void> {
        const scope = await getOfflineScope();
        clearScheduledFlush(scope);
        await offlineDomainDatabase.clearScope(toScopeId(scope));
        await offlineKeyValueStore.multiRemove([
            getLegacyResetKey(scope),
            getScopedStorageKey(LEGACY_KEYS.queue, scope),
            getScopedStorageKey(LEGACY_KEYS.items, scope),
            getScopedStorageKey(LEGACY_KEYS.parties, scope),
            getScopedStorageKey(LEGACY_KEYS.invoices, scope),
            getScopedStorageKey(LEGACY_KEYS.expenses, scope),
            getScopedStorageKey(LEGACY_KEYS.loans, scope),
            getScopedStorageKey(LEGACY_KEYS.godowns, scope),
            getScopedStorageKey(LEGACY_KEYS.cashBank, scope),
            getScopedStorageKey(LEGACY_KEYS.settings, scope),
        ]);
        emitQueueChanged();
    }

    async getCachedItems(): Promise<Item[]> {
        const scope = await getOfflineScope();
        return readCollection<Item>(scope, COLLECTIONS.items);
    }

    async setCachedItems(items: Item[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.items, items);
    }

    async upsertCachedItem(item: Item): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.items, item);
    }

    async archiveCachedItem(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const items = await readCollection<Item>(scope, COLLECTIONS.items);
        const existing = items.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.items, {
            ...existing,
            isActive: false,
            updatedAt: new Date().toISOString(),
        });
    }

    async restoreCachedItem(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const items = await readCollection<Item>(scope, COLLECTIONS.items);
        const existing = items.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.items, {
            ...existing,
            isActive: true,
            updatedAt: new Date().toISOString(),
        });
    }

    async removeCachedItem(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.items, id);
    }

    async getCachedParties(): Promise<Party[]> {
        const scope = await getOfflineScope();
        return readCollection<Party>(scope, COLLECTIONS.parties);
    }

    async setCachedParties(parties: Party[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.parties, parties);
    }

    async upsertCachedParty(party: Party): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.parties, party);
    }

    async archiveCachedParty(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const parties = await readCollection<Party>(scope, COLLECTIONS.parties);
        const existing = parties.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.parties, {
            ...existing,
            isActive: false,
            updatedAt: new Date().toISOString(),
        });
    }

    async restoreCachedParty(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const parties = await readCollection<Party>(scope, COLLECTIONS.parties);
        const existing = parties.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.parties, {
            ...existing,
            isActive: true,
            updatedAt: new Date().toISOString(),
        });
    }

    async removeCachedParty(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.parties, id);
    }

    async getCachedInvoices(): Promise<Invoice[]> {
        const scope = await getOfflineScope();
        return readCollection<Invoice>(scope, COLLECTIONS.invoices);
    }

    async setCachedInvoices(invoices: Invoice[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.invoices, invoices);
    }

    async upsertCachedInvoice(invoice: Invoice): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.invoices, invoice);
    }

    async removeCachedInvoice(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.invoices, id);
    }

    async archiveCachedInvoice(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const invoices = await readCollection<Invoice>(scope, COLLECTIONS.invoices);
        const existing = invoices.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.invoices, {
            ...existing,
            isDeleted: true,
            updatedAt: new Date().toISOString(),
        });
    }

    async updateCachedInvoicePayment(
        id: string,
        payment: { paidAmount?: number; paymentMode?: string; date?: string }
    ): Promise<void> {
        const scope = await getOfflineScope();
        const invoices = await readCollection<Invoice>(scope, COLLECTIONS.invoices);
        const existing = invoices.find((entry) => entry.id === id);
        if (!existing) return;
        const nextPaidAmount = Number(payment.paidAmount ?? existing.paidAmount ?? 0);
        const total = Number(existing.totalInvoiceValue ?? 0);
        const paymentStatus: Invoice['paymentStatus'] =
            nextPaidAmount >= total && total > 0
                ? 'PAID'
                : nextPaidAmount > 0
                    ? 'PARTIALLY_PAID'
                    : 'UNPAID';
        await upsertCollectionRecord(scope, COLLECTIONS.invoices, {
            ...existing,
            paidAmount: nextPaidAmount,
            paymentStatus,
            updatedAt: new Date().toISOString(),
            gstRateBreakupJson: {
                ...asObject(existing.gstRateBreakupJson),
                ...(payment.paymentMode ? { paymentMode: payment.paymentMode } : {}),
                ...(payment.date ? { paymentDate: payment.date } : {}),
            },
        });
    }

    async getCachedExpenses(): Promise<Expense[]> {
        const scope = await getOfflineScope();
        return readCollection<Expense>(scope, COLLECTIONS.expenses);
    }

    async setCachedExpenses(expenses: Expense[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.expenses, expenses);
    }

    async upsertCachedExpense(expense: Expense): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.expenses, expense);
    }

    async archiveCachedExpense(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const expenses = await readCollection<Expense>(scope, COLLECTIONS.expenses);
        const existing = expenses.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.expenses, {
            ...existing,
            isDeleted: true,
            updatedAt: new Date().toISOString(),
        });
    }

    async restoreCachedExpense(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const expenses = await readCollection<Expense>(scope, COLLECTIONS.expenses);
        const existing = expenses.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.expenses, {
            ...existing,
            isDeleted: false,
            updatedAt: new Date().toISOString(),
        });
    }

    async removeCachedExpense(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.expenses, id);
    }

    async getCachedLoans(): Promise<Loan[]> {
        const scope = await getOfflineScope();
        return readCollection<Loan>(scope, COLLECTIONS.loans);
    }

    async setCachedLoans(loans: Loan[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.loans, loans);
    }

    async upsertCachedLoan(loan: Loan): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.loans, loan);
    }

    async appendCachedLoanTransaction(
        loanId: string,
        transaction: LoanTransaction
    ): Promise<void> {
        const scope = await getOfflineScope();
        const loans = await readCollection<Loan>(scope, COLLECTIONS.loans);
        const existing = loans.find((entry) => entry.id === loanId);
        if (!existing) return;
        const nextTransactions = [...(existing.transactions ?? []), transaction];
        await upsertCollectionRecord(scope, COLLECTIONS.loans, {
            ...existing,
            currentBalance: transaction.balanceAfter,
            updatedAt: new Date().toISOString(),
            transactions: nextTransactions,
        });
    }

    async getCachedGodowns(): Promise<Godown[]> {
        const scope = await getOfflineScope();
        return readCollection<Godown>(scope, COLLECTIONS.godowns);
    }

    async setCachedGodowns(godowns: Godown[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.godowns, godowns);
    }

    async upsertCachedGodown(godown: Godown): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.godowns, godown);
    }

    async removeCachedGodown(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.godowns, id);
    }

    async getCachedCashBankAccounts(): Promise<Account[]> {
        const scope = await getOfflineScope();
        return readCollection<Account>(scope, COLLECTIONS.cashBank);
    }

    async setCachedCashBankAccounts(accounts: Account[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.cashBank, accounts);
    }

    async getCachedAccountingAccounts(): Promise<Account[]> {
        const scope = await getOfflineScope();
        return readCollection<Account>(scope, COLLECTIONS.accountingAccounts);
    }

    async setCachedAccountingAccounts(accounts: Account[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.accountingAccounts, accounts);
    }

    async upsertCachedAccountingAccount(account: Account): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.accountingAccounts, account);
    }

    async deactivateCachedAccountingAccount(id: string): Promise<void> {
        const scope = await getOfflineScope();
        const accounts = await readCollection<Account>(scope, COLLECTIONS.accountingAccounts);
        const existing = accounts.find((entry) => entry.id === id);
        if (!existing) return;
        await upsertCollectionRecord(scope, COLLECTIONS.accountingAccounts, {
            ...existing,
            isActive: false,
        });
    }

    async getCachedStaffMembers(): Promise<StaffMember[]> {
        const scope = await getOfflineScope();
        return readCollection<StaffMember>(scope, COLLECTIONS.staffMembers);
    }

    async setCachedStaffMembers(members: StaffMember[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(
            scope,
            COLLECTIONS.staffMembers,
            members.map((member) => ({
                ...member,
                id: member.uid,
                updatedAt: new Date().toISOString(),
            }))
        );
    }

    async upsertCachedStaffMember(member: StaffMember): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.staffMembers, {
            ...member,
            id: member.uid,
            updatedAt: new Date().toISOString(),
        });
    }

    async removeCachedStaffMember(uid: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.staffMembers, uid);
    }

    async getCachedStaffInvites(): Promise<StaffInvite[]> {
        const scope = await getOfflineScope();
        return readCollection<StaffInvite>(scope, COLLECTIONS.staffInvites);
    }

    async setCachedStaffInvites(invites: StaffInvite[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.staffInvites, invites);
    }

    async upsertCachedStaffInvite(invite: StaffInvite): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.staffInvites, invite);
    }

    async removeCachedStaffInvite(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.staffInvites, id);
    }

    async getCachedOperationsControls(): Promise<OperationsControls | null> {
        const scope = await getOfflineScope();
        const rows = await readCollection<StoredOperationsControls>(scope, COLLECTIONS.operationsControls);
        const current = rows[0];
        if (!current) return null;
        const { id: _id, updatedAt: _updatedAt, ...controls } = current;
        return controls;
    }

    async setCachedOperationsControls(controls: OperationsControls): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.operationsControls, [{
            id: 'controls',
            ...controls,
            updatedAt: new Date().toISOString(),
        } satisfies StoredOperationsControls]);
    }

    async getCachedOperationsPeriods(): Promise<FinancialPeriod[]> {
        const scope = await getOfflineScope();
        return readCollection<FinancialPeriod>(scope, COLLECTIONS.operationsPeriods);
    }

    async setCachedOperationsPeriods(periods: FinancialPeriod[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.operationsPeriods, periods);
    }

    async upsertCachedOperationsPeriod(period: FinancialPeriod): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.operationsPeriods, period);
    }

    async getCachedOperationsApprovals(): Promise<OperationApproval[]> {
        const scope = await getOfflineScope();
        return readCollection<OperationApproval>(scope, COLLECTIONS.operationsApprovals);
    }

    async setCachedOperationsApprovals(approvals: OperationApproval[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.operationsApprovals, approvals);
    }

    async upsertCachedOperationsApproval(approval: OperationApproval): Promise<void> {
        const scope = await getOfflineScope();
        await upsertCollectionRecord(scope, COLLECTIONS.operationsApprovals, approval);
    }

    async removeCachedOperationsApproval(id: string): Promise<void> {
        const scope = await getOfflineScope();
        await removeCollectionRecord(scope, COLLECTIONS.operationsApprovals, id);
    }

    async getCachedOperationsAuditLogs(): Promise<OperationsAuditLog[]> {
        const scope = await getOfflineScope();
        return readCollection<OperationsAuditLog>(scope, COLLECTIONS.operationsAuditLogs);
    }

    async setCachedOperationsAuditLogs(logs: OperationsAuditLog[]): Promise<void> {
        const scope = await getOfflineScope();
        await replaceCollection(scope, COLLECTIONS.operationsAuditLogs, logs);
    }

    async getAllCachedSettings(): Promise<Record<string, Record<string, unknown>>> {
        const scope = await getOfflineScope();
        await ensureScopeInitialized(scope);
        return offlineDomainDatabase.getSettingsMap(toScopeId(scope));
    }

    async getCachedSettingsSection(section: string): Promise<Record<string, unknown>> {
        const scope = await getOfflineScope();
        await ensureScopeInitialized(scope);
        return offlineDomainDatabase.getSettingsSection(toScopeId(scope), section);
    }

    async setCachedSettingsSection(section: string, data: Record<string, unknown>): Promise<void> {
        const scope = await getOfflineScope();
        await ensureScopeInitialized(scope);
        await offlineDomainDatabase.setSettingsSection(toScopeId(scope), section, data);
    }
}

export const offlineSyncService = new OfflineSyncService();
