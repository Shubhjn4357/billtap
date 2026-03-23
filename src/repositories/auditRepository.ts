import { offlineSyncService } from '../services/offlineSyncService';

export type AuditEventPayload = {
    eventType: string;
    section: string;
    timestamp: string;
    details: Record<string, unknown>;
};

export const auditRepository = {
    logSettingChange: async (section: string, payload: Record<string, unknown>) => {
        // Enqueue an audit trace for secure background syncing and enterprise visibility
        const event: AuditEventPayload = {
            eventType: 'SETTINGS_MODIFIED',
            section,
            timestamp: new Date().toISOString(),
            details: payload,
        };
        
        // We type cast to 'any' because 'audit_log_event' might not be natively defined
        // in your current MutationSchema types, but offlineSyncService is flexible natively.
        await offlineSyncService.enqueueMutation({
            type: 'audit_log_event' as any,
            payload: event,
        });

        void offlineSyncService.flushQueue();
    },
};
