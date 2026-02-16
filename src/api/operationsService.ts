import { apiClient } from './httpClient';

export interface BusinessControls {
    makerCheckerEnabled: boolean;
    journalApprovalRequired: boolean;
    stockAdjustmentApprovalRequired: boolean;
    periodLockEnabled: boolean;
}

export interface ApprovalRequest {
    id: string;
    module: string;
    requestType: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedBy: string;
    requestedByRole?: string | null;
    reason?: string | null;
    payload: Record<string, unknown>;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reviewNote?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLogEntry {
    id: string;
    module: string;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    actorUid: string;
    actorRole?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, string | number | boolean | null> | null;
    createdAt: string;
}

export interface AccountingPeriod {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: 'open' | 'locked' | 'closed';
    lockedBy?: string | null;
    lockedAt?: string | null;
    closedBy?: string | null;
    closedAt?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export const operationsService = {
    async getControls(): Promise<BusinessControls> {
        const response = await apiClient.get<{ ok: boolean; controls?: BusinessControls; message?: string }>('/operations/controls');
        if (!response.ok || !response.controls) {
            throw new Error(response.message || 'Failed to load controls.');
        }
        return response.controls;
    },

    async updateControls(payload: Partial<BusinessControls>): Promise<BusinessControls> {
        const response = await apiClient.put<{ ok: boolean; controls?: BusinessControls; message?: string }>('/operations/controls', payload);
        if (!response.ok || !response.controls) {
            throw new Error(response.message || 'Failed to update controls.');
        }
        return response.controls;
    },

    async getPendingApprovals(limit = 100): Promise<ApprovalRequest[]> {
        const response = await apiClient.get<{ ok: boolean; approvals?: ApprovalRequest[]; message?: string }>(
            `/operations/approvals?status=pending&limit=${limit}`
        );
        if (!response.ok || !response.approvals) {
            throw new Error(response.message || 'Failed to load approvals.');
        }
        return response.approvals;
    },

    async approveRequest(id: string, note?: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(`/operations/approvals/${id}/approve`, { note });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to approve request.');
        }
    },

    async rejectRequest(id: string, note?: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(`/operations/approvals/${id}/reject`, { note });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to reject request.');
        }
    },

    async getAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
        const response = await apiClient.get<{ ok: boolean; logs?: AuditLogEntry[]; message?: string }>(
            `/operations/audit-logs?limit=${limit}`
        );
        if (!response.ok || !response.logs) {
            throw new Error(response.message || 'Failed to load audit logs.');
        }
        return response.logs;
    },

    async getPeriods(limit = 30): Promise<AccountingPeriod[]> {
        const response = await apiClient.get<{ ok: boolean; periods?: AccountingPeriod[]; message?: string }>(
            `/operations/periods?limit=${limit}`
        );
        if (!response.ok || !response.periods) {
            throw new Error(response.message || 'Failed to load accounting periods.');
        }
        return response.periods;
    },

    async lockPeriod(periodStart: string, periodEnd: string, notes?: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>('/operations/periods/lock', {
            periodStart,
            periodEnd,
            notes,
        });
        if (!response.ok) {
            throw new Error(response.message || 'Failed to lock period.');
        }
    },

    async closePeriod(id: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(`/operations/periods/${id}/close`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to close period.');
        }
    },

    async reopenPeriod(id: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(`/operations/periods/${id}/reopen`);
        if (!response.ok) {
            throw new Error(response.message || 'Failed to reopen period.');
        }
    },
};
