import { addDoc, collection, query, getDocs, limit, orderBy, serverTimestamp, where, type DocumentData } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { AnalyticsEvent, AnalyticsEventType } from '../types';

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

const ANALYTICS_COLLECTION = 'analytics_events';
const DEDUPE_WINDOW_MS = 3000;
const lastEventByKey = new Map<string, number>();

const toEvent = (id: string, raw: DocumentData): AnalyticsEvent => ({
    id,
    userId: raw.userId,
    eventType: raw.eventType,
    source: raw.source,
    planId: raw.planId,
    offerId: raw.offerId,
    value: raw.value,
    currency: raw.currency,
    metadata: raw.metadata,
    createdAt: raw.createdAt,
});

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

export const analyticsService = {
    async logEvent(payload: AnalyticsPayload): Promise<void> {
        if (!payload.userId || !payload.eventType) {
            return;
        }

        if (shouldSkipDuplicate(payload)) {
            return;
        }

        await addDoc(collection(db, ANALYTICS_COLLECTION), {
            userId: payload.userId,
            eventType: payload.eventType,
            source: payload.source ?? null,
            planId: payload.planId ?? null,
            offerId: payload.offerId ?? null,
            value: payload.value ?? null,
            currency: payload.currency ?? null,
            metadata: payload.metadata ?? null,
            createdAt: serverTimestamp(),
        });
    },

    async getEventsInRange(startDate: Date, max = 2000): Promise<AnalyticsEvent[]> {
        const analyticsQuery = query(
            collection(db, ANALYTICS_COLLECTION),
            where('createdAt', '>=', startDate),
            orderBy('createdAt', 'desc'),
            limit(max)
        );
        const snapshot = await getDocs(analyticsQuery);
        return snapshot.docs.map((entry) => toEvent(entry.id, entry.data()));
    },
};
