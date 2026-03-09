import { useQuery, type QueryClient } from '@tanstack/react-query';
import { offlineSyncService } from '../services/offlineSyncService';
import { syncQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export type OfflineSyncQueueEntry = {
    id: string;
    type: string;
    status?: string;
    lastErrorCode?: string;
    createdAt: string;
    attemptCount: number;
    lastAttemptAt?: string;
    lastError?: string;
    nextRetryAt?: number;
};

export const invalidateOfflineSyncQueue = async (
    queryClient: QueryClient,
    businessId?: string | null
) => {
    await queryClient.invalidateQueries({ queryKey: syncQueryKeys.queue(businessId) });
};

export function useOfflineSyncQueue(options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 15_000;

    const query = useQuery({
        queryKey: syncQueryKeys.queue(businessId),
        queryFn: async () => {
            const queue = await offlineSyncService.getQueue();
            return queue as OfflineSyncQueueEntry[];
        },
        enabled,
        staleTime,
    });

    return {
        ...query,
        queue: query.data ?? [],
    };
}
