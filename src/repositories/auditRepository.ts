import { offlineSyncService } from '../services/offlineSyncService';
import {
    getRuntimeBusinessId,
    getRuntimeOrganizationRole,
    getRuntimeUserId,
} from '../services/runtimeSession';
import { operationsQueryKeys } from '../state/domainQueryKeys';
import { queryClient } from '../state/queryClient';
import type { ApiResponse } from '../types/api';
import type { OperationsAuditLog } from '../types/domain';

type SettingsAuditEventInput = {
    section: string;
    action: 'SETTINGS_SECTION_UPDATED' | 'SETTINGS_SECTION_RESET';
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
};

const trimAuditLogs = (logs: OperationsAuditLog[]) => logs.slice(0, 500);

const auditLogQueryPrefix = (businessId?: string | null) =>
    [...operationsQueryKeys.all(businessId), 'audit-logs'] as const;

const writeAuditLogQueryCache = (
    businessId: string | null,
    entry: OperationsAuditLog
) => {
    queryClient.setQueriesData(
        { queryKey: auditLogQueryPrefix(businessId) },
        (current: ApiResponse<{ logs: OperationsAuditLog[] }> | undefined) => {
            if (!current) return current;
            const currentLogs = current.data?.logs ?? [];
            return {
                ...current,
                data: {
                    logs: trimAuditLogs([
                        entry,
                        ...currentLogs.filter((log) => log.id !== entry.id),
                    ]),
                },
            };
        }
    );
};

export const auditRepository = {
    logSettingChange: async (input: SettingsAuditEventInput) => {
        const businessId = getRuntimeBusinessId() ?? 'offline';
        const entry: OperationsAuditLog = {
            id: offlineSyncService.createLocalId('oplog'),
            module: 'settings',
            action: input.action,
            entityType: 'business_settings',
            entityId: `${businessId}:${input.section}`,
            actorUid: getRuntimeUserId(),
            actorRole: getRuntimeOrganizationRole(),
            before: input.before ?? null,
            after: input.after ?? null,
            metadata: {
                section: input.section,
                businessId,
                ...(input.metadata ?? {}),
            },
            createdAt: new Date().toISOString(),
        };

        const currentLogs = await offlineSyncService.getCachedOperationsAuditLogs();
        const nextLogs = trimAuditLogs([
            entry,
            ...currentLogs.filter((log) => log.id !== entry.id),
        ]);
        await offlineSyncService.setCachedOperationsAuditLogs(nextLogs);
        writeAuditLogQueryCache(businessId, entry);
    },
};
