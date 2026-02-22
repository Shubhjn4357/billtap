import type { AnalyticsEvent, AnalyticsEventType } from '../types';
import { isOnline } from '../utils/network';
import { apiClient } from './httpClient';
import { offlineSyncService } from './syncService';
import { shouldThrowClientApiError } from '../utils/errorGuards';

type AnalyticsPayload = {
    userId: string;
    eventType: AnalyticsEventType;
    source?: string;
    planId?: string;
    offerId?: string;
    value?: number;
    currency?: string;
    metadata?: Record<string, string | number | boolean>;
};

const DEDUPE_WINDOW_MS = 3000;
const lastEventByKey = new Map<string, number>();

const shouldSkipDuplicate = (payload: AnalyticsPayload) => {
    const key = `${payload.userId}:${payload.eventType}:${payload.source ?? ''}:${payload.planId ?? ''}:${payload.offerId ?? ''}`;
    const now = Date.now();
    const previous = lastEventByKey.get(key);
    if (previous && now - previous < DEDUPE_WINDOW_MS) {
        return true;
    }
    lastEventByKey.set(key, now);
    return false;
};

const sendEvent = async (payload: AnalyticsPayload): Promise<void> => {
    const response = await apiClient.post<{ ok: boolean; message?: string }>('/analytics/events', {
        eventType: payload.eventType,
        source: payload.source,
        planId: payload.planId,
        offerId: payload.offerId,
        value: payload.value,
        currency: payload.currency,
        metadata: payload.metadata,
    });

    if (!response.ok) {
        throw new Error(response.message || 'Failed to log analytics event.');
    }
};

export const analyticsService = {
    async logEvent(payload: AnalyticsPayload): Promise<void> {
        if (!payload.userId || !payload.eventType) {
            return;
        }

        if (shouldSkipDuplicate(payload)) {
            return;
        }

        const online = await isOnline();
        if (online) {
            try {
                await offlineSyncService.flushQueue();
                await sendEvent(payload);
                return;
            } catch (error: unknown) {
                if (shouldThrowClientApiError(error)) {
                    throw error;
                }
            }
        }

        await offlineSyncService.enqueueMutation({
            type: 'analytics_event',
            payload: {
                eventType: payload.eventType,
                source: payload.source,
                planId: payload.planId,
                offerId: payload.offerId,
                value: payload.value,
                currency: payload.currency,
                metadata: payload.metadata,
            },
        });
    },

    async getEventsInRange(startDate: Date, max = 2000): Promise<AnalyticsEvent[]> {
        const start = encodeURIComponent(startDate.toISOString());
        const response = await apiClient.get<{ ok: boolean; events?: AnalyticsEvent[]; message?: string }>(
            `/analytics/events?startDate=${start}&limit=${Math.max(1, max)}`
        );

        if (!response.ok || !response.events) {
            throw new Error(response.message || 'Failed to fetch analytics events.');
        }

        return response.events;
    },
};
